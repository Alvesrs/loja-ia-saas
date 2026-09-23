const fs=require('node:fs');
const write=(p,s)=>fs.writeFileSync(p,s);
const read=p=>fs.readFileSync(p,'utf8');

write('src/controllers/managerProvisioning.controller.js', `
const crypto=require('node:crypto');
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');

const hash=t=>crypto.createHash('sha256').update(String(t)).digest('hex');
const digits=v=>String(v||'').replace(/\\D/g,'');
const validEmail=v=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v||'').trim());

async function createManagerUser({nome,email,senha,numeroVendas,numeroDono,rankingParticipa,rankingNome}){
 let userId=null,lojaId=null;
 try{
  const prefixo=email.split('@')[0].toLowerCase();
  const username=/^[a-z0-9._-]{3,32}$/.test(prefixo)?prefixo:undefined;
  const {data:created,error:userError}=await supabaseAuth.auth.admin.createUser({email,password:senha,email_confirm:true,user_metadata:username?{username}:{},app_metadata:{saintsai_managed:true,saintsai_mode:'gerenciador'}});
  if(userError||!created?.user?.id)throw userError||new Error('falha_criacao_usuario');
  userId=created.user.id;
  const {data:loja,error:lojaError}=await supabase.from('lojas').insert({dono_id:userId,nome,ativa:true,modo_operacao:'gerenciador',numero_vendas_whatsapp:numeroVendas||null,numero_dono_whatsapp:numeroDono||null,ranking_participa:rankingParticipa!==false,ranking_nome_publico:rankingNome||nome}).select('id,nome,modo_operacao').single();
  if(lojaError||!loja?.id)throw lojaError||new Error('falha_criacao_loja');
  lojaId=loja.id;
  return {user:created.user,loja};
 }catch(e){
  if(lojaId)try{await supabase.from('lojas').delete().eq('id',lojaId)}catch(_){ }
  if(userId)try{await supabaseAuth.auth.admin.deleteUser(userId)}catch(_){ }
  throw e;
 }
}

async function adminDirect(req,res){
 try{
  const nome=String(req.body?.nome||'').trim(),email=String(req.body?.email||'').trim().toLowerCase(),senha=String(req.body?.senha||'');
  const numeroVendas=digits(req.body?.numero_vendas_whatsapp),numeroDono=digits(req.body?.numero_dono_whatsapp);
  if(nome.length<2||nome.length>100)return res.status(400).json({erro:'Nome da loja inválido.'});
  if(!validEmail(email))return res.status(400).json({erro:'E-mail/login inválido.'});
  if(senha.length<6||senha.length>128)return res.status(400).json({erro:'A senha deve ter entre 6 e 128 caracteres.'});
  if(numeroVendas&&numeroVendas.length<10)return res.status(400).json({erro:'Número de vendas inválido.'});
  if(numeroDono&&numeroDono.length<10)return res.status(400).json({erro:'Número oficial do dono inválido.'});
  const out=await createManagerUser({nome,email,senha,numeroVendas,numeroDono,rankingParticipa:req.body?.ranking_participa!==false,rankingNome:String(req.body?.ranking_nome_publico||'').trim()||nome});
  return res.status(201).json({cliente:{id:out.user.id,email:out.user.email},loja:out.loja});
 }catch(e){
  const m=String(e?.message||''); if(/already|registered|exists/i.test(m))return res.status(409).json({erro:'Esse e-mail/login já está cadastrado.'});
  console.error('[manager] adminDirect',m); return res.status(500).json({erro:'Não foi possível criar o Gerenciador.'});
 }
}

async function adminInvite(req,res){
 try{
  const nome=String(req.body?.nome||'').trim(),numeroVendas=digits(req.body?.numero_vendas_whatsapp),numeroDono=digits(req.body?.numero_dono_whatsapp);
  if(nome.length<2||nome.length>100)return res.status(400).json({erro:'Nome da loja inválido.'});
  if(numeroVendas&&numeroVendas.length<10)return res.status(400).json({erro:'Número de vendas inválido.'});
  if(numeroDono&&numeroDono.length<10)return res.status(400).json({erro:'Número oficial do dono inválido.'});
  const token=crypto.randomBytes(32).toString('base64url');
  const {data,error}=await supabase.from('gerenciador_convites').insert({token_hash:hash(token),nome_loja:nome,numero_vendas_whatsapp:numeroVendas||null,numero_dono_whatsapp:numeroDono||null,ranking_participa:req.body?.ranking_participa!==false,ranking_nome_publico:String(req.body?.ranking_nome_publico||'').trim()||nome}).select('id,expira_em').single();
  if(error)throw error;
  return res.status(201).json({convite_id:data.id,expira_em:data.expira_em,link:'cadastro-gerenciador.html?token='+encodeURIComponent(token)});
 }catch(e){console.error('[manager] adminInvite',e?.message||e);return res.status(500).json({erro:'Não foi possível gerar o link de cadastro.'});}
}

async function inviteInfo(req,res){
 try{
  const token=String(req.query?.token||''); if(token.length<20)return res.status(400).json({erro:'Convite inválido.'});
  const {data,error}=await supabase.from('gerenciador_convites').select('id,nome_loja,status,expira_em').eq('token_hash',hash(token)).maybeSingle();
  if(error||!data)return res.status(404).json({erro:'Convite não encontrado.'});
  if(data.status!=='pendente'||new Date(data.expira_em)<=new Date())return res.status(410).json({erro:'Este convite expirou ou já foi utilizado.'});
  return res.json({nome_loja:data.nome_loja,expira_em:data.expira_em});
 }catch(e){return res.status(500).json({erro:'Não foi possível validar o convite.'});}
}

async function signup(req,res){
 const token=String(req.body?.token||''),email=String(req.body?.email||'').trim().toLowerCase(),senha=String(req.body?.senha||'');
 if(token.length<20||!validEmail(email)||senha.length<6||senha.length>128)return res.status(400).json({erro:'Dados de cadastro inválidos.'});
 try{
  const {data:inv,error}=await supabase.from('gerenciador_convites').select('*').eq('token_hash',hash(token)).maybeSingle();
  if(error||!inv)return res.status(404).json({erro:'Convite não encontrado.'});
  if(inv.status!=='pendente'||new Date(inv.expira_em)<=new Date())return res.status(410).json({erro:'Este convite expirou ou já foi utilizado.'});
  const out=await createManagerUser({nome:inv.nome_loja,email,senha,numeroVendas:inv.numero_vendas_whatsapp||'',numeroDono:inv.numero_dono_whatsapp||'',rankingParticipa:inv.ranking_participa,rankingNome:inv.ranking_nome_publico||inv.nome_loja});
  await supabase.from('gerenciador_convites').update({status:'usado',usado_em:new Date().toISOString(),loja_id:out.loja.id,atualizado_em:new Date().toISOString()}).eq('id',inv.id).eq('status','pendente');
  return res.status(201).json({ok:true,email:out.user.email});
 }catch(e){
  const m=String(e?.message||''); if(/already|registered|exists/i.test(m))return res.status(409).json({erro:'Esse e-mail já está cadastrado.'});
  console.error('[manager] signup',m); return res.status(500).json({erro:'Não foi possível concluir o cadastro.'});
 }
}

module.exports={adminDirect,adminInvite,inviteInfo,signup};
`);

write('src/routes/managerProvisioning.routes.js', `
const express=require('express');
const c=require('../controllers/managerProvisioning.controller');
const { exigirLogin }=require('../middleware/auth');
const { exigirAdmin }=require('../middleware/admin');
const router=express.Router();
router.get('/cadastro/info',c.inviteInfo);
router.post('/cadastro',c.signup);
router.post('/admin/direto',exigirLogin,exigirAdmin,c.adminDirect);
router.post('/admin/convite',exigirLogin,exigirAdmin,c.adminInvite);
module.exports=router;
`);

let app=read('src/app.js');
if(!app.includes("managerProvisioningRoutes")){
 app=app.replace("const adminVendasRoutes = require('./routes/adminVendas.routes');","const adminVendasRoutes = require('./routes/adminVendas.routes');\nconst managerProvisioningRoutes = require('./routes/managerProvisioning.routes');");
 app=app.replace("app.use('/api/admin/vendas', adminVendasRoutes);","app.use('/api/admin/vendas', adminVendasRoutes);\napp.use('/api/gerenciador', managerProvisioningRoutes);");
}
write('src/app.js',app);

write('public/cadastro-gerenciador.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090812"><title>Criar acesso · SaintsAI</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 90% 0,#22143e 0,#090812 38%,#07070c 100%);color:#f7f5ff;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;padding:22px}.box{width:min(100%,460px);background:linear-gradient(180deg,#171523,#0f0e17);border:1px solid rgba(157,92,255,.25);border-radius:24px;padding:24px}.brand{text-align:center;margin-bottom:22px}.saints{font:italic 800 34px Georgia,serif;background:linear-gradient(110deg,#fff,#c4b5fd,#8b5cf6);-webkit-background-clip:text;color:transparent}.by{font-size:10px;letter-spacing:3px;color:#a78bfa;font-weight:800}.field{display:grid;gap:7px;margin:13px 0}.field label{font-size:13px;font-weight:800}.field input{width:100%;padding:13px;border-radius:13px;border:1px solid rgba(190,185,215,.2);background:#0b0a12;color:#fff;font:inherit}.btn{width:100%;padding:14px;border:0;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:white;font-weight:900;font-size:15px}.sub{color:#aaa5b7;font-size:13px;line-height:1.5}.status{margin-top:12px;font-size:13px}.ok{color:#4ade80}.bad{color:#f87171}</style></head><body><main class="box"><div class="brand"><div class="saints">SaintsAI</div><div class="by">BY ALVES</div></div><h1>Criar seu acesso</h1><p id="loja" class="sub">Validando convite…</p><div class="field"><label>E-mail/login</label><input id="email" type="email"></div><div class="field"><label>Senha</label><input id="senha" type="password" minlength="6"></div><div class="field"><label>Confirmar senha</label><input id="senha2" type="password" minlength="6"></div><button id="criar" class="btn">Criar minha conta</button><div id="status" class="status"></div><p class="sub">Este link serve somente para criar seu login. Depois, entre pelo app/painel SaintsAI.</p></main><script src="js/config.js"></script><script>const token=new URLSearchParams(location.search).get('token')||'',base=window.API_BASE||'/api';async function api(p,o={}){const r=await fetch(base+p,{...o,headers:{'Content-Type':'application/json',...(o.headers||{})}}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.erro||'Erro');return j}(async()=>{try{const x=await api('/gerenciador/cadastro/info?token='+encodeURIComponent(token));document.getElementById('loja').textContent='Criando acesso para: '+x.nome_loja}catch(e){document.getElementById('loja').textContent=e.message;document.getElementById('criar').disabled=true}})();document.getElementById('criar').onclick=async()=>{const st=document.getElementById('status'),email=document.getElementById('email').value.trim().toLowerCase(),senha=document.getElementById('senha').value,senha2=document.getElementById('senha2').value;if(senha!==senha2){st.className='status bad';st.textContent='As senhas não conferem.';return}const b=document.getElementById('criar');b.disabled=true;st.textContent='Criando conta…';try{await api('/gerenciador/cadastro',{method:'POST',body:JSON.stringify({token,email,senha})});st.className='status ok';st.textContent='Conta criada. Indo para o login…';setTimeout(()=>location.replace('login.html'),900)}catch(e){st.className='status bad';st.textContent=e.message}finally{b.disabled=false}};</script></body></html>`);

console.log('Manager backend v1 aplicado: convite e auto cadastro.');