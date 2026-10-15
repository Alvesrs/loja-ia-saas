'use strict';
const db=require('../config/supabase');
async function superseded(job){
 if(!job.criado_em||!job.loja_id||!job.configuracao_id||!job.contato)return false;
 const {data,error}=await db.from('whatsapp_fila_processamento').select('id').eq('loja_id',job.loja_id).eq('configuracao_id',job.configuracao_id).eq('contato',job.contato).neq('id',job.id).gt('criado_em',job.criado_em).in('status',['pendente','processando','enviado','concluido']).limit(1);
 if(error)throw Error('verificacao_contexto_recente_indisponivel');
 return Boolean(data?.length);
}
module.exports={superseded};
