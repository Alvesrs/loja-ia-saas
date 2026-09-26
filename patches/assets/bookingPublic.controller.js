const booking=require('../services/bookingPublic.service');

function responderErro(res,e){
  const status=Number(e?.status||500);
  const body={erro:e?.message||'Não foi possível concluir o agendamento.',codigo:e?.codigo||'erro'};
  if(e?.preco_atual!==undefined)body.preco_atual=e.preco_atual;
  return res.status(status).json(body);
}

async function resumo(req,res){try{return res.json(await booking.resumo(req.params.token));}catch(e){return responderErro(res,e);}}
async function disponibilidade(req,res){try{return res.json(await booking.disponibilidade(req.params.token,String(req.query.servico_id||'')));}catch(e){return responderErro(res,e);}}
async function confirmar(req,res){try{return res.status(201).json(await booking.confirmar(req.params.token,req.body||{}));}catch(e){return responderErro(res,e);}}
async function status(req,res){try{return res.json(await booking.status(req.params.token,String(req.query.agendamento_id||'')));}catch(e){return responderErro(res,e);}}

module.exports={resumo,disponibilidade,confirmar,status};
