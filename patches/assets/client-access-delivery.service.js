const db=require('../config/supabase');
const base=String(process.env.PUBLIC_BASE_URL||'https://saintsai-cliente.up.railway.app').replace(/\\/$/,'');
function links(){return 'Acesso ao SaintsAI Cliente: '+base+'/cliente-login.html\nComo acessar e baixar para Android: '+base+'/cliente-acesso.html';}
async function notify(payload){if(!['PAYMENT_RECEIVED','PAYMENT_CONFIRMED','CHECKOUT_PAID'].includes(payload?.event))return;
 const qr=payload?.payment?.pixQrCodeId,checkout=payload?.checkout?.id||payload?.payment?.checkoutSession;if(!qr&&!checkout)return;
 const {data:rows,error}=await db.from('saintsai_sales_onboarding').select('*').eq('phase','awaiting_payment').limit(100);if(error)throw error;
 for(const row of rows||[]){const p=row.payment||{};if(![p.provider_qr_id,p.provider_checkout_id].filter(Boolean).includes(String(qr||checkout)))continue;
 const flow=require('./ownerSalesOnboarding.service');if(!await flow.paid(row))continue;
 const {data:claim,error:e}=await db.from('saintsai_sales_onboarding').update({phase:'active',updated_at:new Date().toISOString()}).eq('id',row.id).eq('phase','awaiting_payment').select('*').maybeSingle();if(e)throw e;if(!claim)continue;
 const [{data:c,error:ce},{data:cfgs,error:fe}]=await Promise.all([db.from('saintsai_sales_conversations').select('contato,configuracao_id').eq('id',row.conversa_id).eq('loja_id',row.owner_store_id).maybeSingle(),db.from('whatsapp_configuracoes').select('id,provedor,identificador_externo').eq('loja_id',row.owner_store_id).eq('ativo',true).limit(10)]);if(ce||fe)throw ce||fe;const cfg=(cfgs||[]).find(x=>x.id===c?.configuracao_id);if(!c||!cfg)throw Error('delivery_whatsapp_missing');
 const id='subscription-access-'+row.id+'-'+String(qr||checkout);await require('./whatsappEnvio.service').enviarRespostaWhatsapp({canal:'whatsapp',lojaId:row.owner_store_id,configuracaoId:cfg.id,contato:c.contato,texto:'',idExterno:id,timestamp:new Date().toISOString()},{lojaId:row.owner_store_id,contato:c.contato,idExterno:id,resposta:'Pagamento confirmado pelo Asaas ✅ Seu plano '+row.plan+' está ativo no app.\n'+await flow.access(row)},{provedor:cfg.provedor,destinatarioId:cfg.identificador_externo});
 }
}
module.exports={links,notify};
