'use strict';
const db=require('../config/supabase');
const base=String(process.env.PUBLIC_BASE_URL||'https://backend-prod-production-f338.up.railway.app').replace(/\/+$/,'');
function links(){return 'Acesso ao SaintsAI Cliente: '+base+'/cliente-login.html\nComo acessar e baixar para Android: '+base+'/cliente-acesso.html';}
async function checked(q){const r=await q;if(r.error)throw Error('access_delivery_database_unavailable');return r.data;}
async function deliver(row){
 const flow=require('./ownerSalesOnboarding.service');if(!await flow.paid(row))return;
 let payment=row.payment||{};
 if(row.phase==='awaiting_payment'){
  const claim=await checked(db.from('saintsai_sales_onboarding').update({phase:'active',payment:{...payment,__access_delivery:'pending'},updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','awaiting_payment').eq('payment',JSON.stringify(payment)).select('*').maybeSingle());
  if(!claim)return;row=claim;payment=row.payment||{};
 }
 // Legacy active customers are not automatically replayed. Only new pending deliveries retry.
 if(row.phase!=='active'||payment.__access_delivery!=='pending')return;
 const c=await checked(db.from('saintsai_sales_conversations').select('contato,configuracao_id').eq('id',row.conversa_id).eq('loja_id',row.owner_store_id).maybeSingle());
 const cfgs=await checked(db.from('whatsapp_configuracoes').select('id,provedor,identificador_externo').eq('loja_id',row.owner_store_id).eq('ativo',true).limit(10));
 const cfg=(cfgs||[]).find(x=>x.id===c?.configuracao_id);if(!c||!cfg)throw Error('access_delivery_configuration_missing');
 const access=await flow.access(row);
 const intent={...payment,__access_delivery:'intent',__access_delivery_attempted_at:new Date().toISOString()};
 const claim=await checked(db.from('saintsai_sales_onboarding').update({payment:intent,updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','active').eq('payment',JSON.stringify(payment)).select('id').maybeSingle());if(!claim)return;
 const id='subscription-access-'+row.id+'-'+String(payment.provider_qr_id||payment.provider_checkout_id);
 // Persist only the state, never the temporary password or customer access text.
 await require('./whatsappEnvio.service').enviarRespostaWhatsapp({canal:'whatsapp',lojaId:row.owner_store_id,configuracaoId:cfg.id,contato:c.contato,texto:'',idExterno:id,timestamp:new Date().toISOString()},{lojaId:row.owner_store_id,contato:c.contato,idExterno:id,resposta:'Pagamento confirmado pelo Asaas ✅ Seu plano '+row.plan+' está ativo no app.\n'+access},{provedor:cfg.provedor,destinatarioId:cfg.identificador_externo});
 const done=await checked(db.from('saintsai_sales_onboarding').update({payment:{...intent,__access_delivery:'confirmed'},updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','active').eq('payment',JSON.stringify(intent)).select('id').maybeSingle());if(!done)throw Error('access_delivery_finalization_unavailable');
}
async function notify(payload){
 if(!['PAYMENT_RECEIVED','PAYMENT_CONFIRMED','CHECKOUT_PAID'].includes(payload?.event))return;
 const qr=payload?.payment?.pixQrCodeId,checkout=payload?.checkout?.id||payload?.payment?.checkoutSession;if(!qr&&!checkout)return;
 const rows=await checked(db.from('saintsai_sales_onboarding').select('*').in('phase',['awaiting_payment','active']).eq(qr?'payment->>provider_qr_id':'payment->>provider_checkout_id',String(qr||checkout)).limit(100));
 for(const row of rows||[]){const p=row.payment||{};if(![p.provider_qr_id,p.provider_checkout_id].filter(Boolean).includes(String(qr||checkout)))continue;await deliver(row);}
}
async function retryPending(){
 const rows=await checked(db.from('saintsai_sales_onboarding').select('*').eq('phase','active').eq('payment->>__access_delivery','pending').limit(20));
 for(const row of rows||[]){try{await deliver(row);}catch(_){console.error('[subscription.access] entrega_pendente');}}
}
module.exports={links,notify,retryPending};
