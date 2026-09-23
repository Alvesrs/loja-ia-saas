const fs=require('node:fs');const path=require('node:path');
const src='sales-manager/public/index.html';
if(!fs.existsSync(src)) throw new Error('sales-manager/public/index.html ausente');
fs.mkdirSync('public/gerenciador-vendas',{recursive:true});
fs.copyFileSync(src,'public/gerenciador-vendas/index.html');
let app=fs.readFileSync('src/app.js','utf8');
const marker='// SALES_MANAGER_PREVIEW_ROUTE_V1';
if(!app.includes(marker)){
 const block=`
\n// SALES_MANAGER_PREVIEW_ROUTE_V1
const __salesManagerPath = require('node:path');
const __salesManagerPublic = __salesManagerPath.join(process.cwd(),'public','gerenciador-vendas');
app.use('/gerenciador-vendas', require('express').static(__salesManagerPublic,{index:'index.html',fallthrough:true}));
app.get('/gerenciador-vendas', (_req,res)=>res.sendFile(__salesManagerPath.join(__salesManagerPublic,'index.html')));
\n`;
 const idx=app.indexOf("app.use('/api/");
 if(idx<0) throw new Error('ponto de montagem nao encontrado');
 app=app.slice(0,idx)+block+app.slice(idx);
 fs.writeFileSync('src/app.js',app);
}
console.log('Gerenciador de Vendas publicado em rota isolada.');