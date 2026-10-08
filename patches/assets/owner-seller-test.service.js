const db=require('../config/supabase');
const {randomUUID}=require('node:crypto');
const locks=new Set();
const PHONE='554396431742';
const owner=require('./ownerProspecting.service');
const idem=require('./whatsappIdempotencia.service');
const envio=require('./whatsappEnvio.service');
const {INTRO,MASTER}=require('./ownerSalesPrompt');
const erro=(message,status=409)=>Object.assign(Error(message),{status});
async function restart(usuario,{lojaId,requestId,modo}={}){
 let telefone=PHONE;
 if(!/^[0-9a-f-]{36}$/i.test(requestId||''))throw erro('Requisição de teste inválida.',400);
 if(!process.env.SAINTSAI_OWNER_USER_ID||usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)throw erro('Acesso restrito ao dono.',403);
 const {data:l,error:el}=await db.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();if(el)throw el;if(!l||l.dono_id!==usuario.id)throw erro('Escolha uma loja da sua própria conta.',403);
 if(!/^55\d{10,11}$/.test(String(telefone||'')))throw erro('WhatsApp inválido.',400);
 const {data:cfg,error:ec}=await db.from('whatsapp_configuracoes').select('id,provedor,identificador_externo,numero_whatsapp').eq('loja_id',lojaId).eq('ativo',true).limit(2);if(ec)throw ec;
 if(cfg?.length!==1||cfg[0].provedor!=='waha')throw erro('Conecte seu WhatsApp real por QR no SaintsAI Cliente desta loja para enviar a primeira abordagem.');
 const c=cfg[0],base=String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,'');
 if(!base||!process.env.WAHA_API_KEY)throw erro('Conexão WhatsApp indisponível.',503);
 let sess;try{const r=await fetch(base+'/api/sessions/'+encodeURIComponent(c.identificador_externo),{headers:{'X-Api-Key':process.env.WAHA_API_KEY},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();sess=await r.json();}catch{throw erro('Não foi possível confirmar a conexão. Tente novamente.',503);}
 const numero=String(c.numero_whatsapp||'').replace(/\D/g,'');
 if(sess.status!=='WORKING'||!numero||String(sess.me?.id||'').split('@')[0]!==numero)throw erro('Reconecte o WhatsApp desta loja por QR antes de prospectar.');
 if(telefone===numero||('55439'+telefone.slice(4))===numero)throw erro('Escolha um contato diferente do seu próprio número.',400);
 let contato;try{contato=await owner.chatPorTelefone(c.identificador_externo,telefone);}catch(e){if(e.status!==400)throw e;telefone='55439'+PHONE.slice(4);contato=await owner.chatPorTelefone(c.identificador_externo,telefone);}

 const menu=modo==='botoes';
 const key=lojaId+'|'+contato;if(locks.has(key))throw erro('Um reinício já está em andamento. Aguarde.');locks.add(key);
 try{
 const {data:old,error:eo}=await db.from('saintsai_sales_conversations').select('id,briefing').eq('session_id',c.identificador_externo).eq('contato',contato).maybeSingle();if(eo)throw eo;
 if(old){const {data:real,error:er}=await db.from('saintsai_sales_onboarding').select('id').eq('conversa_id',old.id).limit(1).maybeSingle();if(er)throw er;if(real)throw erro('Este contato já possui uma contratação real. Ela não será apagada pelo teste.');}
 const {data:running,error:ej}=await db.from('whatsapp_fila_processamento').select('id').eq('loja_id',lojaId).eq('contato',contato).eq('status','processando').limit(1);if(ej)throw ej;if(running?.length)throw erro('Aguarde a resposta atual terminar e clique novamente.');
 const event={provedor:'waha',idExterno:'seller-test:'+usuario.id+':'+requestId};
 if(!await idem.reservarEventoWhatsapp(event)){const {data:prior,error:ep}=await db.from('whatsapp_eventos_processados').select('status').eq('provedor',event.provedor).eq('id_externo',event.idExterno).maybeSingle();if(ep)throw ep;if(prior?.status!=='concluido')throw erro('Este reinício ainda está em andamento ou seu envio não foi confirmado. Confira o WhatsApp.',409);return {ok:true,status:'ja_iniciado',telefone};}
 const started=new Date().toISOString(),briefing={__saintsai_test:true,__test_started:started,__test_run:requestId,...(menu?{__test_phase:'cuts'}:{})};
 const {error:reset}=await db.from('saintsai_sales_conversations').upsert({session_id:c.identificador_externo,contato,loja_id:lojaId,configuracao_id:c.id,ativo:true,ativado_em:started,atualizado_em:started,ultimo_evento_id:'prospeccao:iniciado:'+Date.now(),briefing,lead_status:'conversa',briefing_step:0,prompt_rascunho:null,prompt_aprovada:false,prompt_aprovada_em:null,ultimo_audio_em:null,audio_divulgado:false},{onConflict:'session_id,contato'});if(reset)throw reset;
 try{
 const message={canal:'whatsapp',lojaId,configuracaoId:c.id,contato,idExterno:event.idExterno};
 let result;if(menu){const r=await fetch(base+'/api/sendButtons',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':process.env.WAHA_API_KEY},body:JSON.stringify({session:c.identificador_externo,chatId:contato,body:'Demonstração de barbearia. Qual corte você prefere?',footer:'Teste: sem agendamento ou cobrança real',buttons:[{type:'reply',text:'Corte social R$30'},{type:'reply',text:'Degradê R$35'},{type:'reply',text:'Corte e barba R$50'}]}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('buttons_unavailable');const d=await r.json();if(!d?.id)throw Error('buttons_unconfirmed');result={status:'enviado'};}else result=await envio.enviarRespostaWhatsapp(message,{lojaId,contato,idExterno:event.idExterno,resposta:INTRO},{provedor:'waha',destinatarioId:c.identificador_externo});
 if(result.status!=='enviado')throw Error('test_send_unconfirmed');await idem.concluirEventoWhatsapp(event);
 return {ok:true,status:'iniciado',telefone,modo:menu?'botoes':'vendedor'};
 }catch(_){await db.from('saintsai_sales_conversations').update({ativo:false}).eq('session_id',c.identificador_externo).eq('contato',contato).eq('loja_id',lojaId);throw erro(menu?'O envio dos botões não foi confirmado. A conexão por QR pode não suportar este formato. Confira o WhatsApp antes de tentar novamente.':'O envio não foi confirmado. Confira o WhatsApp antes de iniciar um novo teste.',503);}
 }finally{locks.delete(key);}
}
function isTest(c){return c?.briefing?.__saintsai_test===true;}
function offer(){return '🧪 Informações recebidas. Seu agente foi preparado em modo de teste.\n'+require('./ownerSalesOnboarding.service').offer();}
async function handle(args,c){
 if(!isTest(c))return {handled:false};
 const b=c.briefing||{},input=String(args.pergunta||'').trim().toLowerCase();
 if(/^(sair|parar|\/parar|cancelar|não quero|nao quero)$/.test(input)){await save(c,{...b,__test_phase:'cancelled'},false);return {handled:true,response:'Teste encerrado. Você pode reiniciar pela aba Teste do vendedor no ADM.'};}
 if(b.__test_phase==='cuts'){const cuts=[['corte social',30],['degradê',35],['corte e barba',50]];const found=cuts.find(([name])=>input.includes(name));if(!found)return {handled:true,response:'É uma demonstração: escolha corte social, degradê ou corte e barba. Não será criado agendamento real.'};await save(c,{...b,__test_phase:'cuts_payment',__test_cut:found[0],__test_price:found[1]});return {handled:true,response:'Na demonstração, '+found[0]+' custa R$'+found[1]+'. Você prefere Pix ou pagar no local?'};}
 if(b.__test_phase==='cuts_payment'){if(!/pix|local|hora|dinheiro/.test(input))return {handled:true,response:'Você pode escolher Pix ou pagar no local. Este teste não cobra nada.'};await save(c,{...b,__test_phase:'cuts_done'});return {handled:true,response:'Demonstração concluída. '+(/pix/.test(input)?'No atendimento real, o Pix seria gerado com a conta de pagamento conectada.':'No atendimento real, você pagaria ao chegar, se o estabelecimento permitir.')+' Nenhum horário ou pagamento real foi criado.'};}
 if(b.__test_phase==='cuts_done')return {handled:true,response:'Teste de cortes concluído. Você pode iniciar outra demonstração no painel.'};
 if(b.__test_phase==='done')return {handled:true,response:'🧪 Teste concluído: pagamento e ativação simulados. Nenhuma conta, cobrança ou venda real foi criada. Reinicie pelo ADM para começar de novo.'};
 if(b.__test_phase==='payment'){
 if(!/^(pix|cartão|cartao)$/.test(input))return {handled:true,response:'🧪 Escolha PIX ou CARTÃO para simular o pagamento.'};
 await save(c,{...b,__test_phase:'done'});return {handled:true,response:'🧪 '+(input==='pix'?'Pix':'Cartão')+' escolhido. Pagamento aprovado e plano ativado apenas na simulação.\nNo fluxo real, o cliente receberá o acesso temporário e será obrigado a trocar e-mail e senha. Nenhuma conta nem cobrança real foi criada aqui.'};
 }
 if(c.lead_status==='prompt_pronta'){
 const plans=require('./ownerSalesOnboarding.service').available(),plan=plans.find(p=>[p.codigo,p.nome.toLowerCase(),'plano '+p.codigo].includes(input));
 if(!plan)return {handled:true,response:offer()};
 await save(c,{...b,__test_phase:'payment',__test_plan:plan.codigo});return {handled:true,response:'🧪 Conta e agente simulados no plano '+plan.nome+'. Escolha PIX ou CARTÃO. O teste não cria cobrança.'};
 }
 return {handled:false};
}
async function save(c,briefing,ativo=true){const {error}=await db.from('saintsai_sales_conversations').update({briefing,ativo,atualizado_em:new Date().toISOString()}).eq('id',c.id);if(error)throw error;}
async function since(lojaId,contato){const {data,error}=await db.from('saintsai_sales_conversations').select('briefing').eq('loja_id',lojaId).eq('contato',contato).order('atualizado_em',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return isTest(data)?data.briefing.__test_started:null;}
async function stale(job){const date=await since(job.loja_id,job.contato);return date&&(!job.criado_em||Date.parse(job.criado_em)<Date.parse(date));}
function info(usuario){if(usuario?.id!==process.env.SAINTSAI_OWNER_USER_ID)throw erro('Acesso restrito ao dono.',403);return {telefone:PHONE,exibicao:'+55 43 9643-1742'};}
module.exports={restart,handle,isTest,offer,since,stale,info};
