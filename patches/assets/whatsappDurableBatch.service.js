'use strict';
const db=require('../config/supabase');
async function enqueue(message,event,windowMs){
 const {data,error}=await db.rpc('enqueue_waha_batch',{p_loja:message.lojaId,p_config:message.configuracaoId,p_session:event.destinatarioId,p_contact:message.contato,p_text:message.texto,p_external:message.idExterno,p_timestamp:message.timestamp||null,p_window:windowMs});
 if(error||typeof data!=='string'||!/^[a-f0-9-]{36}$/i.test(data))throw Error('durable_batch_unavailable');
 return data;
}
module.exports={enabled:()=>process.env.WHATSAPP_DURABLE_BATCH==='1',enqueue};
