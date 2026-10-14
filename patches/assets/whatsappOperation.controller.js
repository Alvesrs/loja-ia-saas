'use strict';const db=require('../config/supabase');const {ehUuid}=require('../utils/validacao');
async function operacao(req,res){
 const lojaId=req.params.lojaId;if(!ehUuid(lojaId))return res.status(400).json({erro:'Empresa inválida.'});
 try{
  const estados=['pendente','processando','enviado','concluido','falhou'];
  const counts=await Promise.all(estados.map(status=>db.from('whatsapp_fila_processamento').select('id',{count:'exact',head:true}).eq('loja_id',lojaId).eq('status',status)));
  const uncertain=await db.from('whatsapp_fila_processamento').select('id',{count:'exact',head:true}).eq('loja_id',lojaId).in('ultimo_erro_codigo',['envio_incerto','envio_em_andamento']);
  const access=await Promise.all(['pending','intent'].map(state=>db.from('saintsai_sales_onboarding').select('id',{count:'exact',head:true}).eq('owner_store_id',lojaId).eq('phase','active').eq('payment->>__access_delivery',state)));
  if(counts.some(x=>x.error)||uncertain.error||access.some(x=>x.error))throw Error('queue_status_unavailable');
  res.set('Cache-Control','no-store');return res.json({fila:Object.fromEntries(estados.map((s,i)=>[s,counts[i].count||0])),envios_a_conferir:uncertain.count||0,acessos_pendentes:access[0].count||0,acessos_a_conferir:access[1].count||0,consultado_em:new Date().toISOString()});
 }catch(_){return res.status(503).json({erro:'Não foi possível consultar a fila agora.'});}
}
module.exports={operacao};
