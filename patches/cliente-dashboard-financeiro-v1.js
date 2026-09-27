const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

for(const [src,dst] of [
  ['patches/assets/clienteFinanceiro.controller.js','src/controllers/clienteFinanceiro.controller.js'],
  ['patches/assets/clienteFinanceiro.routes.js','src/routes/clienteFinanceiro.routes.js'],
  ['patches/assets/cliente-dashboard-financeiro-v1.js','public/js/cliente-dashboard-financeiro-v1.js'],
  ['patches/assets/cliente-dashboard-financeiro-v1.css','public/css/cliente-dashboard-financeiro-v1.css']
]) fs.copyFileSync(src,dst);

let app=read('src/app.js');
if(!app.includes("const clienteFinanceiroRoutes = require('./routes/clienteFinanceiro.routes');")){
  const anchor="const agendaProfissionalRoutes = require('./routes/agendaProfissional.routes');";
  if(app.includes(anchor))app=app.replace(anchor,anchor+"\nconst clienteFinanceiroRoutes = require('./routes/clienteFinanceiro.routes');");
  else{
    const fallback="const clientePlanoRoutes = require('./routes/clientePlano.routes');";
    if(!app.includes(fallback))throw new Error('Require de rotas do cliente não encontrado');
    app=app.replace(fallback,fallback+"\nconst clienteFinanceiroRoutes = require('./routes/clienteFinanceiro.routes');");
  }
}
if(!app.includes("app.use('/api/lojas/:lojaId/cliente-financeiro', clienteFinanceiroRoutes);")){
  const anchor="app.use('/api/lojas/:lojaId/agenda-profissional', agendaProfissionalRoutes);";
  if(app.includes(anchor))app=app.replace(anchor,anchor+"\napp.use('/api/lojas/:lojaId/cliente-financeiro', clienteFinanceiroRoutes);");
  else{
    const fallback="app.use('/api/lojas/:lojaId/cliente-plano', clientePlanoRoutes);";
    if(!app.includes(fallback))throw new Error('Mount cliente-plano não encontrado');
    app=app.replace(fallback,fallback+"\napp.use('/api/lojas/:lojaId/cliente-financeiro', clienteFinanceiroRoutes);");
  }
}
write('src/app.js',app);

let central=read('public/cliente-central.html');
if(!central.includes('cliente-dashboard-financeiro-v1.css')){
  central=central.replace('</head>','<link rel="stylesheet" href="css/cliente-dashboard-financeiro-v1.css"></head>');
}
if(!central.includes('cliente-dashboard-financeiro-v1.js')){
  central=central.replace('</body>','<script src="js/cliente-dashboard-financeiro-v1.js"></script></body>');
}
write('public/cliente-central.html',central);

for(const p of [
  'src/controllers/clienteFinanceiro.controller.js',
  'src/routes/clienteFinanceiro.routes.js',
  'src/app.js',
  'public/js/cliente-dashboard-financeiro-v1.js'
]) cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});

if(!central.includes('cliente-dashboard-financeiro-v1.js'))throw new Error('Dashboard financeiro não carregado na Home');
console.log('Dashboard financeiro real aplicado: vendido, recebido, pendente, cancelado e ticket médio.');
