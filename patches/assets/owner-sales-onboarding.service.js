const db=require('../config/supabase');
const {createHmac,randomUUID}=require('node:crypto');
const plans=require('../config/planos');
const billing=require('./asaas.service');
const subscriptions=require('./assinaturas.service');
const {recusou,relacionadaAoSaintsai,RESPOSTA_RECUSA}=require('./ownerSalesPrompt');
const TABLE='saintsai_sales_onboarding';
const now=()=>new Date().toISOString();
const text=v=>String(v||'').trim().slice(0,3000);
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
function available(){return plans.listarPlanos().filter(p=>p.vendavel&&Number.isInteger(p.precoMensalCentavos)&&p.precoMensalCentavos>0);}
function offer(){const p=available();return p.length?'Seu agente está preparado. Escolha o plano mensal:\n'+p.map(x=>x.nome+' ('+x.codigo+'): '+money(x.precoMensalCentavos)+'/mês · '+x.descricao).join('\n')+'\nResponda com o nome do plano para confirmar a contratação. Depois você escolhe Pix ou cartão.':'Seu agente está preparado. O responsável precisa confirmar os preços dos planos antes da contratação. Não será gerada nenhuma cobrança agora.';}
async function checked(result){if(result.error)throw result.error;return result.data;}
async function conversation(lojaId,contato){
 const store=await checked(await db.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle());
 if(!process.env.SAINTSAI_OWNER_USER_ID||store?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return null;
 const c=await checked(await db.from('saintsai_sales_conversations').select('id,ativo,ultimo_evento_id,briefing,prompt_rascunho,lead_status').eq('loja_id',lojaId).eq('contato',contato).eq('ativo',true).limit(1).maybeSingle());
 return c&&/^prospeccao:(aberto|iniciado):/.test(c.ultimo_evento_id||'')?c:null;
}
async function get(id){return checked(await db.from(TABLE).select('*').eq('conversa_id',id).maybeSingle());}
async function change(row,phase,fields={}){return checked(await db.from(TABLE).update({...fields,phase,updated_at:now()}).eq('id',row.id).eq('phase',row.phase).select('*').maybeSingle());}
async function ensure(c,lojaId){let row=await get(c.id);if(row)return row;const r=await db.from(TABLE).insert({conversa_id:c.id,owner_store_id:lojaId,phase:'offer'}).select('*').single();if(r.error?.code==='23505')return get(c.id);return checked(r);}
function credential(row){return 'S!'+createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update('saintsai-first-access-v1:'+row.id).digest('base64url').slice(0,26);}
function email(row){return 'cliente-'+row.id+'@acesso.saintsai.invalid';}
async function provision(row,c,plan){
 const locked=await change(row,'creating',{plan:plan.codigo});
 if(!locked)return 'Sua contratação já está sendo preparada. Aguarde um instante.';
 let userId=null;
 try{
  const made=await db.auth.admin.createUser({email:email(row),password:credential(row),email_confirm:true,app_metadata:{saintsai_managed:true,saintsai_first_access:true,saintsai_sales_onboarding:row.id,saintsai_business_profile:require('./businessProfiles.service').forBriefing(c.briefing,row.prospect).codigo}});
  if(made.error||!made.data?.user?.id)throw Error('provision_user');
  userId=made.data.user.id;
  await checked(await db.from(TABLE).update({customer_user_id:userId,updated_at:now()}).eq('id',row.id));
  const id=randomUUID();
  await checked(await db.rpc('saintsai_provision_sales_account',{p_onboarding:row.id,p_store:id,p_user:userId,p_name:text(c.briefing?.nome_empresa).slice(0,100)||'Minha empresa',p_prompt:(String(c.prompt_rascunho||'')+require('./businessProfiles.service').prompt(c.briefing,row.prospect)).slice(0,20000)}));
  return 'Sua conta e seu agente foram preparados no plano '+plan.nome+'. Como deseja pagar? Responda PIX (mensal, sem renovação automática) ou CARTÃO (assinatura mensal recorrente). O serviço só será liberado após a confirmação do pagamento.';
 }catch(_){await db.from(TABLE).update({phase:'needs_owner',updated_at:now()}).eq('id',row.id);return 'Não foi possível concluir a preparação com segurança. O responsável vai revisar sua contratação antes de continuar. Nenhuma nova tentativa de cadastro ou cobrança será feita automaticamente.';}
}
async function access(row){const u=await db.auth.admin.getUserById(row.customer_user_id);if(u.error)throw u.error;const base=String(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');return u.data?.user?.app_metadata?.saintsai_first_access===true?'Acesse '+base+'/cliente/login.html\nE-mail temporário: '+email(row)+'\nSenha temporária: '+credential(row)+'\nNo primeiro acesso, você deverá trocar os dois. Sua empresa e seu agente continuam na mesma conta.':'Seu acesso já foi personalizado. Entre no SaintsAI Cliente com seu e-mail e senha pessoais.';}
function paymentText(row){const p=row.payment||{};if(p.ambiente!=='production')return 'Este pagamento é de teste e não libera o plano comercial. O responsável precisa configurar o Asaas de produção.';return row.payment_method==='pix'?'Pix de '+money(p.valor_centavos)+' (1 mês). Válido até '+new Date(row.due_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.\nCopie e cole:\n'+p.pix_copia_cola:'Assinatura mensal recorrente no cartão: '+p.checkout_url+'\nO link expira em até 60 minutos. Confira o valor e as condições antes de pagar.';}
async function charge(row,method){
 if(!billing.configurado()||!billing.webhookConfigurado()||billing.ambiente()!=='production')return 'O recebimento em produção ainda precisa ser configurado pelo responsável. Não vou gerar uma cobrança de teste para você.';
 const locked=await change(row,'charging',{payment_method:method,duration_months:1});if(!locked)return 'Seu pagamento já está sendo preparado. Aguarde um instante.';
 try{
  const p=method==='pix'?await billing.criarPixPlano({lojaId:row.customer_store_id,planoCodigo:row.plan,duracaoMeses:1}):await billing.criarCheckoutAssinatura({lojaId:row.customer_store_id,planoCodigo:row.plan});
  const due=method==='pix'?(p.expira_em||new Date(Date.now()+24*60*60*1000).toISOString()):new Date(Date.now()+60*60*1000).toISOString();
  const saved=await checked(await db.from(TABLE).update({phase:'awaiting_payment',payment:p,due_at:due,updated_at:now()}).eq('id',row.id).eq('phase','charging').select('*').single());
  return paymentText(saved)+'\n\n'+await access(saved)+'\nA confirmação será feita pelo Asaas; uma mensagem dizendo “paguei” não libera o plano.';
 }catch(_){await db.from(TABLE).update({phase:'needs_owner',updated_at:now()}).eq('id',row.id);return 'O pagamento não foi confirmado na preparação. O responsável vai conferir antes de gerar outro, para evitar duplicidade.';}
}
async function paid(row){
 const p=row.payment||{},provider=p.provider_checkout_id||p.provider_qr_id;if(!provider||p.ambiente!=='production')return false;
 const charge=await checked(await db.from('cobrancas_assinaturas').select('status_provider').eq('loja_id',row.customer_store_id).eq('provider_checkout_id',provider).maybeSingle());
 const sub=await subscriptions.buscarAssinaturaAtual(row.customer_store_id);
 return /^(PAYMENT_RECEIVED|PAYMENT_CONFIRMED|PAID)$/i.test(charge?.status_provider||'')&&sub?.status==='ativo';
}
function usageHelp(input){
 if(/whatsapp|qr|conectar.*número|conectar.*numero/.test(input))return 'No SaintsAI Cliente, abra WhatsApp e escolha conectar por QR. No celular do número que atenderá seus clientes, abra WhatsApp > Aparelhos conectados > Conectar aparelho e leia o QR. Se o QR estiver no mesmo celular, exiba-o em outra tela. Depois confira se aparece conectado.';
 if(/pagamento|receber|asaas|pix/.test(input))return 'Para receber as vendas do seu negócio, abra Pagamentos no SaintsAI Cliente e conecte sua própria conta Asaas. Configure também se aceita pagar no local. Sua mensalidade SaintsAI é separada dos pagamentos dos seus clientes. Nunca envie sua chave ou senha por aqui.';
 if(/foto|vídeo|video|galeria|imagem/.test(input))return 'Abra Galeria no SaintsAI Cliente, adicione suas fotos ou vídeos e descreva o que cada arquivo mostra. Assim o agente consegue relacionar a mídia ao pedido do cliente. Você pode começar com poucos arquivos e completar depois.';
 if(/serviço|servico|agenda|horário|horario|profissional/.test(input))return 'Cadastre seus serviços com preço e duração, os profissionais e os horários disponíveis no SaintsAI Cliente. Depois faça um agendamento de teste antes de divulgar. O agente precisa desses dados para oferecer horários corretos.';
 if(/como.*usar|começar|comecar|primeiros passos|ajuda|configurar/.test(input))return 'Primeiro entre no SaintsAI Cliente e troque o e-mail e a senha temporários. Depois conecte o WhatsApp e revise os dados do seu negócio. Configure serviços, agenda e pagamentos conforme precisar. Qual dessas etapas você quer fazer agora?';
 return null;
}
async function handle(args){
 const c=await conversation(args.lojaId,args.contato);if(!c)return {handled:false};
 const input=text(args.pergunta).toLowerCase();let row=await get(c.id);
 if(/^(\/parar|parar|sair|cancelar)$/.test(input)||recusou(input)){
  if(row)await change(row,'declined');await checked(await db.from('saintsai_sales_conversations').update({ativo:false,atualizado_em:now()}).eq('id',c.id));
  return {handled:true,response:RESPOSTA_RECUSA};
 }
 const planoValido=available().some(p=>input===p.codigo.toLowerCase()||input===p.nome.toLowerCase()||input==='plano '+p.codigo.toLowerCase()||input==='quero '+p.codigo.toLowerCase());
 const pagamentoValido=row?.phase==='payment_method'&&/^(pix|quero pix|cart[aã]o|cart[aã]o de cr[eé]dito|quero cart[aã]o)$/.test(input);
 if(!relacionadaAoSaintsai(input)&&!planoValido&&!pagamentoValido)return {handled:true,response:null};
 if(row?.phase==='briefing'){if(c.lead_status!=='prompt_pronta')return {handled:false};row=await change(row,'offer');}
 if(!row&&c.lead_status==='prompt_pronta')row=await ensure(c,args.lojaId);
 if(!row)return {handled:false};
 let response;
 if(row.phase==='offer'){
  const plan=available().find(p=>input===p.codigo||input===p.nome.toLowerCase()||input==='plano '+p.codigo||input==='quero '+p.codigo);
  response=plan?await provision(row,c,plan):offer();
 }else if(row.phase==='payment_method'){
  const method=/^(pix|quero pix)$/.test(input)?'pix':/^(cartão|cartao|cartão de crédito|cartao de credito|quero cartão|quero cartao)$/.test(input)?'card':null;
  response=method?await charge(row,method):'Responda PIX para pagar 1 mês ou CARTÃO para uma assinatura mensal recorrente.';
 }else if(row.phase==='awaiting_payment'){
  if(await paid(row)){await change(row,'active');response='Pagamento confirmado pelo Asaas. Seu plano está ativo!\n'+await access(row)+'\nAgora conecte seu WhatsApp, o recebimento das suas vendas e sua galeria. Seu agente já está configurado com as informações que você passou.';}
  else if(row.due_at&&Date.parse(row.due_at)<Date.now())response='O prazo deste link terminou e ainda não há confirmação de pagamento. O responsável vai conferir a cobrança antes de emitir outra.';
  else response='Ainda aguardamos a confirmação do Asaas.\n'+paymentText(row)+'\n\n'+await access(row);
 }else if(row.phase==='active')response=usageHelp(input)||('Seu plano já está ativo.\n'+await access(row));
 else if(row.phase==='needs_owner')response='Sua contratação está em revisão pelo responsável. Não vou repetir o cadastro nem a cobrança.';
 else response='Sua contratação está sendo preparada. Aguarde um instante.';
 return {handled:true,response};
}
async function after(args,response){if(response===null||response===undefined||String(response).trim()==='')return response;const c=await conversation(args.lojaId,args.contato);if(c?.lead_status==='prompt_pronta'){const row=await ensure(c,args.lojaId);if(row?.phase==='briefing')await change(row,'offer');return offer();}return response;}
async function list(usuario,lojaId){
 if(!process.env.SAINTSAI_OWNER_USER_ID||usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)throw Object.assign(Error('Acesso restrito ao dono.'),{status:403});
 const store=await checked(await db.from('lojas').select('dono_id').eq('id',lojaId).maybeSingle());if(store?.dono_id!==usuario.id)throw Object.assign(Error('Escolha uma loja da sua conta.'),{status:403});
 const rows=await checked(await db.from(TABLE).select('id,conversa_id,phase,plan,payment_method,customer_store_id,due_at,created_at,updated_at,prospect,payment').eq('owner_store_id',lojaId).order('updated_at',{ascending:false}).limit(100));
 for(const row of rows||[]){if(row.phase==='awaiting_payment'&&await paid(row)){await change(row,'active');row.phase='active';}delete row.payment;}
 return {vendas:rows||[],planos:available().map(p=>({codigo:p.codigo,nome:p.nome,valor_centavos:p.precoMensalCentavos})),pagamento_pronto:billing.configurado()&&billing.webhookConfigurado()&&billing.ambiente()==='production'};
}
async function remember(usuario,{lojaId,telefone,prospect}={}){if(!prospect||usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)return;const owner=require('./ownerProspecting.service');const stores=await owner.minhasLojas(usuario);const store=stores.find(x=>x.id===lojaId);if(!store)return;const cfg=await checked(await db.from('whatsapp_configuracoes').select('identificador_externo').eq('loja_id',lojaId).eq('ativo',true).limit(1).maybeSingle());if(!cfg)return;const contato=await owner.chatPorTelefone(cfg.identificador_externo,telefone);const c=await conversation(lojaId,contato);if(!c)return;const safe={nome:text(prospect.nome).slice(0,120),categoria:text(prospect.categoria).slice(0,80),cidade:text(prospect.cidade).slice(0,100)};const existing=await get(c.id);if(existing)return;const saved=await db.from(TABLE).insert({conversa_id:c.id,owner_store_id:lojaId,phase:'briefing',prospect:safe});if(saved.error&&saved.error.code!=='23505')throw saved.error;}
module.exports={remember,handle,after,list,available,offer,conversation,provision,charge,paid};
