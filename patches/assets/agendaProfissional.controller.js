const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');
const svc=require('../services/agendaProfissional.service');

async function acesso(lojaId,usuario){
  const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
  if(error)throw error;if(!loja)return false;
  if(loja.dono_id===usuario.id)return true;
  if(usuarioEhAdmin(usuario)){
    try{const {data}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);return data?.user?.app_metadata?.saintsai_managed===true;}catch(_){return false;}
  }
  return false;
}
function fail(res,e){
  if(e?.codigo)return res.status(Number(e.status||400)).json({erro:e.message,codigo:e.codigo});
  console.error('[agenda-profissional]',e?.message||e);return res.status(500).json({erro:'Não foi possível atualizar a agenda.'});
}
async function resumo(req,res){try{const id=String(req.params.lojaId||'');if(!(await acesso(id,req.usuario)))return res.status(403).json({erro:'Sem acesso.'});return res.json(await svc.resumo(id,{dias:req.query.dias}));}catch(e){return fail(res,e)}}
async function criarBloqueio(req,res){try{const id=String(req.params.lojaId||'');if(!(await acesso(id,req.usuario)))return res.status(403).json({erro:'Sem acesso.'});return res.status(201).json(await svc.criarBloqueio(id,req.body||{}));}catch(e){return fail(res,e)}}
async function removerBloqueio(req,res){try{const id=String(req.params.lojaId||'');if(!(await acesso(id,req.usuario)))return res.status(403).json({erro:'Sem acesso.'});await svc.removerBloqueio(id,String(req.params.bloqueioId||''));return res.json({ok:true});}catch(e){return fail(res,e)}}
async function alterarAgendamento(req,res){try{const id=String(req.params.lojaId||'');if(!(await acesso(id,req.usuario)))return res.status(403).json({erro:'Sem acesso.'});return res.json(await svc.alterarAgendamento(id,String(req.params.agendamentoId||''),req.body||{}));}catch(e){return fail(res,e)}}
module.exports={resumo,criarBloqueio,removerBloqueio,alterarAgendamento};
