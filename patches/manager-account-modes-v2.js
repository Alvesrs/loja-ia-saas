const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

let c=read('src/controllers/managerProvisioning.controller.js');
c=c.replace("async function createManagerUser({nome,email,senha,numeroVendas,numeroDono,rankingParticipa,rankingNome}){","async function createManagerUser({nome,email,senha,numeroVendas,numeroDono,rankingParticipa,rankingNome,managed=true}){");
c=c.replace("app_metadata:{saintsai_managed:true,saintsai_mode:'gerenciador'}","app_metadata:{saintsai_managed:managed===true,saintsai_mode:'gerenciador',saintsai_account_origin:managed===true?'painel':'app'}");
c=c.replace("modo_operacao:'gerenciador',numero_vendas_whatsapp","modo_operacao:managed===true?'gerenciador':'gerenciador_independente',numero_vendas_whatsapp");

if(!c.includes('async function standaloneSignup')){
 const fn=[
  "",
  "async function standaloneSignup(req,res){",
  " try{",
  "  const nome=String(req.body?.nome||'').trim();",
  "  const email=String(req.body?.email||'').trim().toLowerCase();",
  "  const senha=String(req.body?.senha||'');",
  "  if(nome.length<2||nome.length>100)return res.status(400).json({erro:'Nome da loja inválido.'});",
  "  if(!validEmail(email))return res.status(400).json({erro:'E-mail inválido.'});",
  "  if(senha.length<6||senha.length>128)return res.status(400).json({erro:'A senha deve ter entre 6 e 128 caracteres.'});",
  "  const out=await createManagerUser({nome,email,senha,numeroVendas:digits(req.body?.numero_vendas_whatsapp),numeroDono:digits(req.body?.numero_dono_whatsapp),rankingParticipa:req.body?.ranking_participa!==false,rankingNome:String(req.body?.ranking_nome_publico||'').trim()||nome,managed:false});",
  "  return res.status(201).json({ok:true,tipo_conta:'independente',gerenciado_pelo_painel:false,cliente:{id:out.user.id,email:out.user.email},loja:out.loja});",
  " }catch(e){",
  "  const m=String(e?.message||'');",
  "  if(/already|registered|exists/i.test(m))return res.status(409).json({erro:'Esse e-mail já está cadastrado.'});",
  "  console.error('[manager] standaloneSignup',m);",
  "  return res.status(500).json({erro:'Não foi possível criar a conta.'});",
  " }",
  "}"
 ].join('\n');
 c=c.replace("module.exports={adminDirect,adminInvite,inviteInfo,signup};",fn+"\nmodule.exports={adminDirect,adminInvite,inviteInfo,signup,standaloneSignup};");
}
write('src/controllers/managerProvisioning.controller.js',c);

let routes=read('src/routes/managerProvisioning.routes.js');
if(!routes.includes("'/cadastro-independente'")){
 routes=routes.replace("router.post('/cadastro',c.signup);","router.post('/cadastro',c.signup);\nrouter.post('/cadastro-independente',c.standaloneSignup);");
}
write('src/routes/managerProvisioning.routes.js',routes);

let d=read('src/controllers/managerDashboard.controller.js');
d=d.replace(".eq('modo_operacao','gerenciador').maybeSingle()",".in('modo_operacao',['gerenciador','gerenciador_independente']).maybeSingle()");
d=d.replace(".eq('modo_operacao','gerenciador').eq('ranking_participa',true)",".in('modo_operacao',['gerenciador','gerenciador_independente']).eq('ranking_participa',true)");
d=d.replace("return res.json({modo_operacao:'gerenciador',loja})","return res.json({modo_operacao:'gerenciador',tipo_conta:loja.modo_operacao==='gerenciador_independente'?'independente':'vinculada',gerenciado_pelo_painel:loja.modo_operacao!=='gerenciador_independente',loja})");
write('src/controllers/managerDashboard.controller.js',d);

write('public/cadastro-gerenciador-independente.html',"<!doctype html>\n<html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#090812\"><title>Criar conta · SaintsAI Gerenciador</title>\n<style>\n*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 90% 0,#22143e 0,#090812 38%,#07070c 100%);color:#f7f5ff;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;padding:22px}\n.box{width:min(100%,460px);background:linear-gradient(180deg,#171523,#0f0e17);border:1px solid rgba(157,92,255,.25);border-radius:24px;padding:24px}\n.brand{text-align:center;margin-bottom:20px}.saints{font:italic 800 34px Georgia,serif;background:linear-gradient(110deg,#fff,#c4b5fd,#8b5cf6);-webkit-background-clip:text;color:transparent}\n.by{font-size:10px;letter-spacing:3px;color:#a78bfa;font-weight:800}.field{display:grid;gap:7px;margin:13px 0}.field label{font-size:13px;font-weight:800}\n.field input{width:100%;padding:13px;border-radius:13px;border:1px solid rgba(190,185,215,.2);background:#0b0a12;color:#fff;font:inherit}\n.btn{width:100%;padding:14px;border:0;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:white;font-weight:900;font-size:15px}\n.sub{color:#aaa5b7;font-size:13px;line-height:1.5}.status{margin-top:12px;font-size:13px}.ok{color:#4ade80}.bad{color:#f87171}\n</style></head>\n<body><main class=\"box\"><div class=\"brand\"><div class=\"saints\">SaintsAI</div><div class=\"by\">BY ALVES</div></div>\n<h1 style=\"font-size:23px;margin-bottom:6px\">Criar conta no Gerenciador</h1>\n<p class=\"sub\">Esta conta será independente. Ela funciona normalmente no aplicativo, mas não será vinculada ao painel administrativo de outra pessoa.</p>\n<div class=\"field\"><label>Nome da loja</label><input id=\"nome\" maxlength=\"100\" autocomplete=\"organization\"></div>\n<div class=\"field\"><label>E-mail</label><input id=\"email\" type=\"email\" autocomplete=\"email\"></div>\n<div class=\"field\"><label>Senha</label><input id=\"senha\" type=\"password\" minlength=\"6\" autocomplete=\"new-password\"></div>\n<div class=\"field\"><label>Confirmar senha</label><input id=\"senha2\" type=\"password\" minlength=\"6\" autocomplete=\"new-password\"></div>\n<button id=\"criar\" class=\"btn\">Criar minha conta</button><div id=\"status\" class=\"status\"></div>\n<p class=\"sub\">Já tem conta? <a href=\"login.html?next=gerenciador.html\" style=\"color:#c4b5fd\">Entrar</a></p>\n</main><script src=\"js/config.js\"></script><script>\nconst api=(p,o={})=>fetch((window.API_BASE||'/api')+p,{...o,headers:{'Content-Type':'application/json',...(o.headers||{})}}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.erro||'Erro');return j});\ndocument.getElementById('criar').onclick=async()=>{\n const st=document.getElementById('status'),b=document.getElementById('criar');\n const nome=document.getElementById('nome').value.trim(),email=document.getElementById('email').value.trim().toLowerCase();\n const senha=document.getElementById('senha').value,senha2=document.getElementById('senha2').value;\n if(nome.length<2){st.className='status bad';st.textContent='Informe o nome da loja.';return}\n if(senha!==senha2){st.className='status bad';st.textContent='As senhas não conferem.';return}\n b.disabled=true;st.className='status';st.textContent='Criando conta…';\n try{\n  await api('/gerenciador/cadastro-independente',{method:'POST',body:JSON.stringify({nome,email,senha})});\n  st.className='status ok';st.textContent='Conta criada. Indo para o login…';\n  setTimeout(()=>location.replace('login.html?next=gerenciador.html'),800);\n }catch(e){st.className='status bad';st.textContent=e.message}\n finally{b.disabled=false}\n};\n</script></body></html>");
console.log('Manager account modes v2 aplicado: painel vinculado + app independente.');
