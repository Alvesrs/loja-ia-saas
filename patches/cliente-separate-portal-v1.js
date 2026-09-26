const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

let login=read('public/login.html');
login=login.replace(/<title>[^<]*<\/title>/i,'<title>SaintsAI Cliente</title>');
login=login.replace(/<div class="login-brand[^>]*>[^<]*<\/div>/i,'<div class="login-brand brand">SaintsAI Cliente</div>');
login=login.replace(/<p class="login-sub">[^<]*<\/p>/i,'<p class="login-sub">Entre para gerenciar sua empresa</p>');

login=login.replace(/const\s+nextParam\s*=.*?;\s*const\s+destinoPermitido\s*=.*?;\s*const\s+destinoAposLogin\s*=.*?;/s,
"const nextParam = 'cliente-central.html';\n  const destinoPermitido = ['cliente-central.html'];\n  const destinoAposLogin = 'cliente-central.html';");

login=login.replace(/if\s*\(estaAutenticado\(\)\)\s*\{[\s\S]*?\}/,
"if (estaAutenticado()) {\n    window.location.replace('cliente-central.html');\n  }");

write('public/cliente-login.html',login);

let app=read('src/app.js');
if(!app.includes('SAINTSAI_CLIENT_PORTAL_V1')){
  const block=`
// SAINTSAI_CLIENT_PORTAL_V1
const __saintsaiClientPath = require('node:path');
const __saintsaiClientDir = __saintsaiClientPath.join(process.cwd(), 'public');

app.get('/cliente', (_req, res) => res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-login.html')));
app.get('/cliente/', (_req, res) => res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-login.html')));
app.get('/cliente/login.html', (_req, res) => res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-login.html')));
app.get('/cliente/cliente-central.html', (_req, res) => res.sendFile(__saintsaiClientPath.join(__saintsaiClientDir, 'cliente-central.html')));
app.use('/cliente', require('express').static(__saintsaiClientDir, {
  index: false,
  fallthrough: true,
  redirect: false
}));
`;
  const anchor="app.use('/api/auth'";
  const i=app.indexOf(anchor);
  if(i<0)throw new Error('Anchor de rotas não encontrado');
  app=app.slice(0,i)+block+'\n'+app.slice(i);
}
write('src/app.js',app);

console.log('Portal SaintsAI Cliente criado em /cliente sem alterar o painel admin.');
