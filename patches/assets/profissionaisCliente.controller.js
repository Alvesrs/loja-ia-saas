const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');
const svc=require('../services/profissionais.service');

async function podeAcessar(lojaId,usuario){
  const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
  if(error)throw error;if(!loja)return false;
  if(loja.dono_id===usuario.id)return true;
  if(usuarioEhAdmin(usuario)){
    try{
      const {data}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
      return data?.user?.app_metadata?.saintsai_managed===true;
    }catch(_){return false;}
  }
  return false;
}

function erroHttp(res,e){
  const m=String(e?.message||'');
  if(m==='nome_invalido')return res.status(400).json({erro:'Informe um nome válido para o profissional.'});
  if(m==='horarios_invalidos')return res.status(400).json({erro:'Confira os horários do profissional.'});
  if(m==='servico_invalido')return res.status(400).json({erro:'Um dos serviços selecionados é inválido.'});
  if(m==='profissional_nao_encontrado')return res.status(404).json({erro:'Profissional não encontrado.'});
  console.error('[profissionais]',m||e);
  return res.status(500).json({erro:'Não foi possível salvar a equipe.'});
}

async function listar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await podeAcessar(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.json(await svc.listar(lojaId));
  }catch(e){return erroHttp(res,e);}
}
async function criar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await podeAcessar(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.status(201).json(await svc.criar(lojaId,req.body||{}));
  }catch(e){return erroHttp(res,e);}
}
async function atualizar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await podeAcessar(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.json(await svc.atualizar(lojaId,String(req.params.profissionalId||''),req.body||{}));
  }catch(e){return erroHttp(res,e);}
}
async function desativar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await podeAcessar(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    await svc.desativar(lojaId,String(req.params.profissionalId||''));
    return res.json({ok:true});
  }catch(e){return erroHttp(res,e);}
}
module.exports={listar,criar,atualizar,desativar};
