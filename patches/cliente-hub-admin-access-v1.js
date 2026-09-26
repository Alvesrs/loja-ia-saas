const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let c=read('src/controllers/clienteHub.controller.js');

if(!c.includes("const supabaseAuth = require('../config/supabaseAuth');")){
  c=c.replace("const supabase = require('../config/supabase');","const supabase = require('../config/supabase');\nconst supabaseAuth = require('../config/supabaseAuth');\nconst { usuarioEhAdmin } = require('../middleware/admin');");
}

const old=`async function lojaDoUsuario(lojaId, usuarioId) {
  const { data, error } = await supabase
    .from('lojas')
    .select('id,nome,dono_id')
    .eq('id', lojaId)
    .eq('dono_id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function exigirLoja(req,res){
  const loja=await lojaDoUsuario(String(req.params.lojaId||''),req.usuario.id);
  if(!loja){res.status(404).json({erro:'Loja não encontrada.'});return null;}
  return loja;
}`;

const neu=`async function lojaDoUsuario(lojaId, usuario) {
  const { data: loja, error } = await supabase
    .from('lojas')
    .select('id,nome,dono_id')
    .eq('id', lojaId)
    .maybeSingle();
  if (error) throw error;
  if (!loja) return null;

  if (loja.dono_id === usuario.id) return loja;

  if (usuarioEhAdmin(usuario)) {
    try {
      const { data: usuarioCliente, error: erroUsuario } = await supabaseAuth.auth.admin.getUserById(loja.dono_id);
      if (!erroUsuario && usuarioCliente?.user?.app_metadata?.saintsai_managed === true) {
        return loja;
      }
    } catch (_) {}
  }

  return null;
}

async function exigirLoja(req,res){
  const loja=await lojaDoUsuario(String(req.params.lojaId||''),req.usuario);
  if(!loja){res.status(403).json({erro:'Você não tem acesso a essa loja.'});return null;}
  return loja;
}`;

if(!c.includes(old)) throw new Error('Função de acesso clienteHub não encontrada');
c=c.replace(old,neu);
write('src/controllers/clienteHub.controller.js',c);

/* PagBank: aplica a mesma regra, para o Admin testar cliente gerenciado sem quebrar a etapa pagamentos */
let pb=read('src/controllers/pagBankConnect.controller.js');
if(!pb.includes("const supabaseAuth=require('../config/supabaseAuth');")){
  pb=pb.replace("const supabase=require('../config/supabase');","const supabase=require('../config/supabase');\nconst supabaseAuth=require('../config/supabaseAuth');\nconst {usuarioEhAdmin}=require('../middleware/admin');");
}
const oldCheck=`    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).eq('dono_id',req.usuario.id).maybeSingle();
    if(error)throw error;
    if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});
    return res.json(await svc.iniciar({lojaId,usuarioId:req.usuario.id}));`;
const newCheck=`    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
    if(error)throw error;
    if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});
    let permitido=loja.dono_id===req.usuario.id;
    if(!permitido&&usuarioEhAdmin(req.usuario)){
      const {data:usuarioCliente}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);
      permitido=usuarioCliente?.user?.app_metadata?.saintsai_managed===true;
    }
    if(!permitido)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.json(await svc.iniciar({lojaId,usuarioId:req.usuario.id}));`;
if(!pb.includes(oldCheck)) throw new Error('Checagem PagBank não encontrada');
pb=pb.replace(oldCheck,newCheck);
write('src/controllers/pagBankConnect.controller.js',pb);

cp.execFileSync(process.execPath,['--check','src/controllers/clienteHub.controller.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','src/controllers/pagBankConnect.controller.js'],{stdio:'inherit'});
console.log('Cliente Hub alinhado ao acesso Admin de clientes gerenciados.');