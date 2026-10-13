'use strict';
const db=require('../config/supabase');
const INTENT='envio_em_andamento',UNCERTAIN='envio_incerto';
function uncertain(job){return job?.status!=='enviado'&&[INTENT,UNCERTAIN].includes(job?.ultimo_erro_codigo);}
async function prepare(job,response){
 const until=Date.parse(job.lease_ate);
 if(!Number.isFinite(until)||until<=Date.now())return false;
 let q=db.from('whatsapp_fila_processamento').update({resposta_texto:response.resposta,ultimo_erro_codigo:INTENT,atualizado_em:new Date().toISOString()})
  .eq('id',job.id).eq('status','processando').eq('tentativas',job.tentativas).eq('lease_ate',job.lease_ate);
 q=job.ultimo_erro_codigo?q.eq('ultimo_erro_codigo',job.ultimo_erro_codigo):q.is('ultimo_erro_codigo',null);
 const result=await q.select('id').maybeSingle();
 if(result.error)throw Error('intencao_envio_indisponivel');
 return !!result.data;
}
async function quarantine(job){
 const result=await db.from('whatsapp_fila_processamento').update({status:'falhou',lease_ate:null,ultimo_erro_codigo:UNCERTAIN,atualizado_em:new Date().toISOString()})
  .eq('id',job.id).eq('status','processando').eq('tentativas',job.tentativas).select('id').maybeSingle();
 if(result.error)throw Error('revisao_envio_indisponivel');
 return !!result.data;
}
module.exports={INTENT,UNCERTAIN,uncertain,prepare,quarantine};
