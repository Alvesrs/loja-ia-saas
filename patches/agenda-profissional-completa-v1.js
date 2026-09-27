const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

for(const [src,dst] of [
  ['patches/assets/profissionais.service.js','src/services/profissionais.service.js'],
  ['patches/assets/profissionaisCliente.controller.js','src/controllers/profissionaisCliente.controller.js'],
  ['patches/assets/cliente-profissionais-v1.js','public/js/cliente-profissionais-v1.js'],
  ['patches/assets/cliente-profissionais-v1.css','public/css/cliente-profissionais-v1.css'],
  ['patches/assets/agendaProfissional.service.js','src/services/agendaProfissional.service.js'],
  ['patches/assets/agendaProfissional.controller.js','src/controllers/agendaProfissional.controller.js'],
  ['patches/assets/agendaProfissional.routes.js','src/routes/agendaProfissional.routes.js'],
  ['patches/assets/cliente-agenda.html','public/cliente-agenda.html']
]) fs.copyFileSync(src,dst);

let app=read('src/app.js');
if(!app.includes("const agendaProfissionalRoutes = require('./routes/agendaProfissional.routes');")){
  const anchor="const clientePlanoRoutes = require('./routes/clientePlano.routes');";
  if(app.includes(anchor)) app=app.replace(anchor,anchor+"\nconst agendaProfissionalRoutes = require('./routes/agendaProfissional.routes');");
  else{
    const fallback="const clienteHubRoutes = require('./routes/clienteHub.routes');";
    if(!app.includes(fallback))throw new Error('Require de rotas do cliente não encontrado');
    app=app.replace(fallback,fallback+"\nconst agendaProfissionalRoutes = require('./routes/agendaProfissional.routes');");
  }
}
if(!app.includes("app.use('/api/lojas/:lojaId/agenda-profissional', agendaProfissionalRoutes);")){
  const anchor="app.use('/api/lojas/:lojaId/cliente-plano', clientePlanoRoutes);";
  if(app.includes(anchor))app=app.replace(anchor,anchor+"\napp.use('/api/lojas/:lojaId/agenda-profissional', agendaProfissionalRoutes);");
  else{
    const fallback="app.use('/api/lojas/:lojaId/cliente-hub', clienteHubRoutes);";
    if(!app.includes(fallback))throw new Error('Mount cliente-hub não encontrado');
    app=app.replace(fallback,fallback+"\napp.use('/api/lojas/:lojaId/agenda-profissional', agendaProfissionalRoutes);");
  }
}

if(!app.includes('SAINTSAI_CLIENT_AGENDA_PRO_V1')){
  const clientMount="app.use('/cliente', require('express').static";
  const pos=app.indexOf(clientMount);
  if(pos<0)throw new Error('Mount /cliente não encontrado');
  const block=[
    "// SAINTSAI_CLIENT_AGENDA_PRO_V1",
    "app.get('/cliente/cliente-agenda.html',(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(require('node:path').join(process.cwd(),'public','cliente-agenda.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,pos)+block+app.slice(pos);

  const painelMount="app.use('/painel', require('express').static";
  const p2=app.indexOf(painelMount);
  if(p2<0)throw new Error('Mount /painel não encontrado');
  const block2=[
    "app.get('/painel/cliente-agenda.html',(_req,res)=>{",
    "  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');",
    "  res.set('Pragma','no-cache');res.set('Expires','0');",
    "  return res.sendFile(require('node:path').join(process.cwd(),'public','cliente-agenda.html'));",
    "});",
    ""
  ].join('\n');
  app=app.slice(0,p2)+block2+app.slice(p2);
}
write('src/app.js',app);

let config=read('public/cliente-configuracao.html');
config=config.replace(/cliente-central\.html\?aba=agenda/g,'cliente-agenda.html');
write('public/cliente-configuracao.html',config);

let central=read('public/cliente-central.html');
central=central.replace(/cliente-central\.html\?aba=agenda/g,'cliente-agenda.html');
write('public/cliente-central.html',central);

for(const p of [
  'src/services/profissionais.service.js',
  'src/controllers/profissionaisCliente.controller.js',
  'src/services/agendaProfissional.service.js',
  'src/controllers/agendaProfissional.controller.js',
  'src/routes/agendaProfissional.routes.js',
  'src/app.js',
  'public/js/cliente-profissionais-v1.js'
])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

const html=read('public/cliente-agenda.html');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(html))){
  const code=m[1].trim();if(!code)continue;
  const tmp=path.join(os.tmpdir(),'saintsai-agenda-pro-'+(++n)+'.js');
  fs.writeFileSync(tmp,code);
  try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}
  finally{try{fs.unlinkSync(tmp)}catch(_){}}
}
if(!n)throw new Error('Tela Agenda profissional sem JavaScript');
console.log('Agenda profissional completa aplicada: pausas, bloqueios, folgas, férias, feriados, reagendamento e no-show.');
