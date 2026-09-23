const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);

write('src/controllers/managerProvisioning.controller.js',`
const crypto=require('node:crypto');
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const phone=v=>String(v||'').replace(/\\D/g,'');
const hash=t=>crypto.createHash('sha256').update(String(t)).digest('hex');
const emailOk=v=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v||'').trim());

async function provisionar(o){
 let uid=null,lid=null;
 try{
  const prefix=o.email.split('@')[0].toLowerCase();
  const username=/^[a-z0-9._-]{3,32}$/.test(prefix)?prefix:undefined;
  const {data:u,error:eu}=await supabaseAuth.auth.admin.createUser({email:o.email,password:o.senha,email_confirm:true,user_metadata:username?{username}:{},app_metadata:{saintsai_managed:true,saintsai_mode:'gerenciador'}});
  if(eu||!u?.user?.id)throw eu||new Error('falha_usuario');uid=u.user.id;
  const {data:l,error:el}=await supabase.from('lojas').insert({dono_id:uid,nome:o.nome,ativa:true,modo_operacao:'gerenciador',numero_vendas_whatsapp:o.numeroVendas||null,numero_dono_whatsapp:o.numeroDono||null,ranking_participa:o.rankingParticipa!==false,ranking_nome_publico:o.rankingNomePublico||o.nome}).select('id,nome,modo_operacao').single();
  if(el||!l?.id)throw el||new Error('falha_loja');lid=l.id;return{user:u.user,loja:l};
 }catch(e){if(lid)try{await supabase.from('lojas').delete().eq('id',lid)}catch(_){}if(uid)try{await supabaseAuth.auth.admin.deleteUser(uid)}catch(_){}throw e}
}
function dados(body){
 return{nome:String(body?.nome||'').trim(),email:String(body?.email||'').trim().toLowerCase(),senha:String(body?.senha||''),numeroVendas:phone(body?.numero_vendas_whatsapp),numeroDono:phone(body?.numero_dono_whatsapp),rankingParticipa:body?.ranking_participa!==false,rankingNomePublico:String(body?.ranking_nome_publico||'').trim()};
}
function validar(o,login=true){if(o.nome.length<2||o.nome.length>100)return'Nome da loja inválido.';if(login&&!emailOk(o.email))return'E-mail/login inválido.';if(login&&(o.senha.length<6||o.senha.length>128))return'A senha deve ter entre 6 e 128 caracteres.';if(o.numeroVendas&&o.numeroVendas.length<10)return'Número de vendas inválido.';if(o.numeroDono&&o.numeroDono.length<10)return'Número oficial do dono inválido.';return null}

async function criarDireto(req,res){
 try{const o=dados(req.body),v=validar(o,true);if(v)return res.status(400).json({erro:v});const r=await provisionar(o);return res.status(201).json({cliente:{id:r.user.id,email:r.user.email},loja:r.loja})}
 catch(e){if(/already|registered|exists/i.test(String(e?.message||'')))return res.status(409).json({erro:'Esse e-mail/login já está cadastrado.'});console.error('[manager] direto',e?.message||e);return res.status(500).json({erro:'Não foi possível criar o Gerenciador.'})}
}
async function criarConvite(req,res){
 try{const o=dados(req.body),v=validar(o,false);if(v)return res.status(400).json({erro:v});const token=crypto.randomBytes(32).toString('base64url');const {data,error}=await supabase.from('gerenciador_convites').insert({token_hash:hash(token),nome_loja:o.nome,numero_vendas_whatsapp:o.numeroVendas||null,numero_dono_whatsapp:o.numeroDono||null,ranking_participa:o.rankingParticipa,ranking_nome_publico:o.rankingNomePublico||o.nome}).select('id,expira_em').single();if(error)throw error;return res.status(201).json({convite_id:data.id,expira_em:data.expira_em,link:'/painel/cadastro-gerenciador.html?token='+encodeURIComponent(token)})}
 catch(e){console.error('[manager] convite',e?.message||e);return res.status(500).json({erro:'Não foi possível gerar o link de cadastro.'})}
}
async function infoConvite(req,res){
 const token=String(req.query?.token||'');if(token.length<20)return res.status(400).json({erro:'Convite inválido.'});
 const {data,error}=await supabase.from('gerenciador_convites').select('id,nome_loja,status,expira_em').eq('token_hash',hash(token)).maybeSingle();
 if(error||!data)return res.status(404).json({erro:'Convite não encontrado.'});if(data.status!=='pendente'||new Date(data.expira_em)<=new Date())return res.status(410).json({erro:'Este convite expirou ou já foi utilizado.'});return res.json({nome_loja:data.nome_loja,expira_em:data.expira_em});
}
async function consumirConvite(req,res){
 try{
  const token=String(req.body?.token||''),o={email:String(req.body?.email||'').trim().toLowerCase(),senha:String(req.body?.senha||'')};if(token.length<20||!emailOk(o.email)||o.senha.length<6)return res.status(400).json({erro:'Dados de cadastro inválidos.'});
  const {data:c,error}=await supabase.from('gerenciador_convites').select('*').eq('token_hash',hash(token)).maybeSingle();if(error||!c)return res.status(404).json({erro:'Convite não encontrado.'});if(c.status!=='pendente'||new Date(c.expira_em)<=new Date())return res.status(410).json({erro:'Este convite expirou ou já foi utilizado.'});
  const r=await provisionar({nome:c.nome_loja,email:o.email,senha:o.senha,numeroVendas:c.numero_vendas_whatsapp||'',numeroDono:c.numero_dono_whatsapp||'',rankingParticipa:c.ranking_participa,rankingNomePublico:c.ranking_nome_publico||c.nome_loja});
  await supabase.from('gerenciador_convites').update({status:'usado',usado_em:new Date().toISOString(),loja_id:r.loja.id,atualizado_em:new Date().toISOString()}).eq('id',c.id).eq('status','pendente');
  return res.status(201).json({ok:true,email:r.user.email,loja:r.loja});
 }catch(e){if(/already|registered|exists/i.test(String(e?.message||'')))return res.status(409).json({erro:'Esse e-mail já está cadastrado.'});console.error('[manager] cadastro',e?.message||e);return res.status(500).json({erro:'Não foi possível concluir o cadastro.'})}
}
module.exports={criarDireto,criarConvite,infoConvite,consumirConvite};
`);

write('src/routes/managerProvisioning.routes.js',`
const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const {exigirAdmin}=require('../middleware/admin');
const c=require('../controllers/managerProvisioning.controller');
const r=express.Router();
r.get('/cadastro/info',c.infoConvite);r.post('/cadastro',c.consumirConvite);
r.post('/admin/direto',exigirLogin,exigirAdmin,c.criarDireto);r.post('/admin/convite',exigirLogin,exigirAdmin,c.criarConvite);
module.exports=r;
`);

let app=read('src/app.js');
if(!app.includes('managerProvisioningRoutes')){
 app=app.replace("const adminVendasRoutes = require('./routes/adminVendas.routes');","const adminVendasRoutes = require('./routes/adminVendas.routes');\nconst managerProvisioningRoutes = require('./routes/managerProvisioning.routes');");
 app=app.replace("app.use('/api/admin/vendas', adminVendasRoutes);","app.use('/api/admin/vendas', adminVendasRoutes);\napp.use('/api/gerenciador', managerProvisioningRoutes);");
}
write('src/app.js',app);
console.log('Manager backend v1 aplicado.');
