const db=require('../config/supabase');
const phones=new Set(['554396431742@c.us','5543996431742@c.us','554396431742','5543996431742']);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const checked=async r=>{if(r.error)throw r.error;return r.data;};
const reply=(response,interativo)=>({handled:true,response,...(interativo?{interativo}:{})});
const testPrices={basico:1,pro:2,ilimitado:3};
const money=p=>'R$ '+(testPrices[p.codigo]/100).toFixed(2).replace('.',',');
function plans(flow){return flow.available().map(p=>({...p,precoMensalCentavos:testPrices[p.codigo]}));}
function menu(flow){return require('./acoesWhatsapp.service').escolhas(plans(flow).map(p=>({value:'testeplano:'+p.codigo,title:p.nome,description:money(p)+' · '+flow.quota(p),forceList:true})));}
async function handle(args,c){
 if(!phones.has(args.contato)||c.briefing?.__lab_subscription_test!==true)return null;
 const store=await checked(await db.from('lojas').select('dono_id').eq('id',args.lojaId).maybeSingle());if(!process.env.SAINTSAI_OWNER_USER_ID||store?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return null;
 const flow=require('./ownerSalesOnboarding.service'),t=norm(args.pergunta);let row=await checked(await db.from('saintsai_sales_onboarding').select('*').eq('conversa_id',c.id).eq('owner_store_id',args.lojaId).maybeSingle());
 const b=c.briefing||{};
 const demoPhase=String(b.__owner_sales_demo_phase||'');
 const saveDemo=async(fields)=>{const {error}=await db.from('saintsai_sales_conversations').update({briefing:{...b,...fields},atualizado_em:new Date().toISOString()}).eq('id',c.id);if(error)throw error;};
 const demoStart=/(?:demonstr|simular|simulacao|como funciona|me mostra funcionando|testar atendimento|teste da barbearia|exemplo de atendimento)/.test(t);
 const accept=/(?:quero contratar|vou contratar|pode contratar|aceito|gostei.*quero|quero comprar|pode mandar os planos|vamos contratar)/.test(t);
 const yes=/^(?:sim|s|quero|pode|pode sim|claro|ok|pode mostrar|me mostra|mostra|quero ver|manda|envia|pode enviar|com certeza)$/i.test(t);
 if(demoStart){
   await saveDemo({__owner_sales_demo_phase:'confirm_image',__owner_sales_demo_name:null});
   return reply('Quer que eu te mostre como seria um atendimento de exemplo para uma barbearia?');
 }
 if(demoPhase==='confirm_image'){
   if(yes){
     const media=require('./galeriaMedia.service');
     const {data,error}=await db.from('saintsai_galeria').select('id,loja_id,tipo,descricao,etiquetas,ativo,storage_bucket,arquivo_path,criado_em').eq('loja_id',args.lojaId).eq('ativo',true).eq('tipo','foto').order('criado_em',{ascending:false}).limit(500);
     if(error)throw error;
     const normal=v=>norm(v).replace(/[^a-z0-9 ]+/g,' ').replace(/\\s+/g,' ').trim();
     const item=(data||[]).find(m=>normal(m.descricao)==='imagem de demonstracao'&&media.seguro(m,args.lojaId));
     if(!item)return reply('A imagem de demonstração ainda não está cadastrada nesta loja. Cadastre na Galeria uma foto com a descrição exata "Imagem de demonstração". Não vou enviar outra foto no lugar.');
     await saveDemo({__owner_sales_demo_phase:'showcase'});
     return {...reply('Esta imagem mostra como um cliente seria atendido pelo WhatsApp. Depois de ver, responda "quero contratar" para escolher um plano.'),midias:[{id:item.id,tipo:item.tipo,url:media.url(item,args.lojaId),descricao:item.descricao}]};
   }
   if(/^(?:nao|não|agora nao|depois)$/.test(t)){await saveDemo({__owner_sales_demo_phase:null});return reply('Tudo bem. Quando quiser, peça uma demonstração.');}
   return reply('Quer ver a imagem de demonstração de atendimento para uma barbearia? Responda sim ou não.');
 }
 if(accept&&demoPhase==='showcase'){await saveDemo({__owner_sales_demo_phase:'offered',__lab_subscription_select:true});return reply('Os planos exclusivos deste teste são: Básico R$ 0,01, Pro R$ 0,02 e Ilimitado R$ 0,03. Escolha o plano; pagamentos existentes não serão duplicados.',menu(flow));}
 if(demoPhase==='showcase'&&!/(?:pix|pagamento|plano|preco|valor|centavo)/.test(t))return reply('Gostou do exemplo de atendimento? Responda "quero contratar" para ver os planos de teste exclusivos.');
 const menuRequest=/(?:planos?|pre[cç]os?|valores?|op[cç][oõ]es)/.test(t)&&/(?:mostra|mostrar|manda|mande|envia|envie|quero|qual|ver|lista|teste|centavo|novamente|de novo)/.test(t);
 if(menuRequest)return reply('Planos de TESTE autorizados para este número:\nBásico R$ 0,01\nPro R$ 0,02\nIlimitado R$ 0,03\nEsses valores não são os preços comerciais. Se houver um Pix pendente, ele não será duplicado.',menu(flow));
 const paymentRequest=/\bpix\b|\bpagamento\b|(?:[123]|um|dois|tres) centavo|0[,.]0[123]/.test(t);
 const retryRequest=/(?:manda|mande|envia|envie|mostra|mostre|gera|gerar|reenvia|reenviar).{0,45}(?:de novo|novamente|outra vez|pix|planos?|valores?|precos?)|(?:de novo|novamente|reenvia|reenviar|tenta novamente)|(?:preco|valor).{0,25}(?:teste|centavo)/.test(t);
 const start=/contrat.*teste|cliente.*teste|atualiz.*plano|mudar.*plano|trocar.*plano|\bcomprar\b|\bcontratar\b/.test(t);
 const requested=plans(flow).find(p=>t==='testeplano:'+p.codigo||t===p.codigo||t===norm(p.nome)||t==='plano '+p.codigo);
 if(!start&&!requested&&!paymentRequest&&!retryRequest&&!b.__lab_subscription_select&&!/^(pix|gerar pix|paguei|pagamento|meu plano|acesso|baixar|baixar app)$/.test(t))return null;
 if(retryRequest&&(!row||row.phase==='offer'||row.phase==='active'))return reply('Planos exclusivos do teste autorizado: Básico R$ 0,01, Pro R$ 0,02 e Ilimitado R$ 0,03. Escolha o plano para continuar.',menu(flow));
 if(row?.phase==='awaiting_payment'){
  if(await flow.paid(row)){row=await checked(await db.from('saintsai_sales_onboarding').update({phase:'active',updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','awaiting_payment').select('*').maybeSingle())||row;}
  else if(t==='cancelar pix'){
   try{const qr=row.payment?.provider_qr_id;if(!qr)throw Error('missing_qr');const sub=require('./asaasSubconta.service'),cfg=sub.cfg();if(cfg.ambiente!=='production'||!String(cfg.rootKey||'').startsWith('$aact_prod_'))throw Error('configuration');
    const payments=await sub.req('/v3/payments?pixQrCodeId='+encodeURIComponent(qr)+'&limit=100',{method:'GET'},cfg.rootKey);if(!Array.isArray(payments.data)||payments.data.length)return reply('O Asaas já registra uma transação para este Pix. Aguarde a confirmação antes de trocar o plano.');
    const removed=await sub.req('/v3/pix/qrCodes/static/'+encodeURIComponent(qr),{method:'DELETE'},cfg.rootKey);if(removed?.deleted!==true)throw Error('unconfirmed');
    row=await checked(await db.from('saintsai_sales_onboarding').update({phase:'offer',payment:null,due_at:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','awaiting_payment').select('*').maybeSingle());if(!row)return reply('Sua conta está sendo atualizada. Peça seu plano novamente.');
    await checked(await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_subscription_select:true},atualizado_em:new Date().toISOString()}).eq('id',c.id));
    return reply('O Pix anterior foi cancelado no Asaas. Escolha o plano para gerar um novo pagamento real de teste.',menu(flow));
   }catch{return reply('Não consegui confirmar o cancelamento no Asaas. O Pix anterior continua registrado; não vou duplicar a cobrança.');}
  }
  else if(paymentRequest||start)return reply(flow.paymentText(row)+'\nPara escolher outro plano de teste, envie “cancelar Pix”.');
  else return reply('A contratação ainda aguarda a confirmação do Asaas. Não será criada outra cobrança enquanto este pagamento estiver pendente. Peça “pagamento” para conferir o Pix.');
 }
 if(row&&['creating','charging','needs_owner'].includes(row.phase))return reply('Esta contratação está em preparação ou revisão. Não vou repetir o cadastro nem a cobrança.');
 if(start||(!row&&!requested)){
  await checked(await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_subscription_select:true},atualizado_em:new Date().toISOString()}).eq('id',c.id));
  return reply('Contratação real de teste: escolha seu plano. Básico R$ 0,01, Pro R$ 0,02 e Ilimitado R$ 0,03 por mês, exclusivamente nesta conta de teste. A ativação acontece após pagar o Pix; não há renovação automática.',menu(flow));
 }
 if(requested&&(b.__lab_subscription_select||!row||row.phase==='offer')){
  if(!row)row=await checked(await db.from('saintsai_sales_onboarding').insert({conversa_id:c.id,owner_store_id:args.lojaId,phase:'offer'}).select('*').single());
  if(!row.customer_store_id){const response=await flow.provision(row,c,requested);row=await checked(await db.from('saintsai_sales_onboarding').select('*').eq('id',row.id).maybeSingle());if(!row?.customer_store_id||row.phase!=='payment_method')return reply(response);}
  else {row=await checked(await db.from('saintsai_sales_onboarding').update({plan:requested.codigo,phase:'payment_method',payment:null,due_at:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase',row.phase).select('*').maybeSingle());if(!row)return reply('Sua seleção já está sendo preparada. Aguarde.');}
  await require('./condicoesComerciais.service').salvar(row.customer_store_id,{tipo:'personalizado',plano:requested.codigo,preco_mensal_centavos:testPrices[requested.codigo]},store.dono_id);
  await checked(await db.from('saintsai_sales_conversations').update({briefing:{...b,__lab_subscription_select:false},atualizado_em:new Date().toISOString()}).eq('id',c.id));
  return reply('Plano '+requested.nome+' selecionado por '+money(requested)+'. O plano no app só muda depois da confirmação do pagamento.',require('./acoesWhatsapp.service').escolhas([{title:'Pagar '+money({codigo:row.plan}),value:'pix'}]));
 }
 if(row?.phase==='payment_method'){
  if(paymentRequest)return reply(await flow.charge(row,'pix'));
  return reply('Seu plano selecionado aguarda o Pix de '+money({codigo:row.plan})+'.',require('./acoesWhatsapp.service').escolhas([{title:'Pagar '+money({codigo:row.plan}),value:'pix'}]));
 }
 if(row?.phase==='active')return reply('Seu plano '+(flow.available().find(p=>p.codigo===row.plan)?.nome||row.plan)+' está ativo.\n'+await flow.access(row)+'\nPara mudar, diga “atualizar meu plano”.');
 return reply('Diga “iniciar contratação de teste” para escolher seu plano.',menu(flow));
}
module.exports={handle,plans};
