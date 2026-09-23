const fs=require('node:fs');
fs.mkdirSync('src/routes',{recursive:true});
fs.copyFileSync('sales-manager-runtime/sales-manager.routes.js','src/routes/sales-manager.routes.js');
const appPath='src/app.js';
let app=fs.readFileSync(appPath,'utf8');
const marker='// SALES_MANAGER_API_V2';
if(!app.includes(marker)){
  const block="\n// SALES_MANAGER_API_V2\napp.use('/api/gv', require('./routes/sales-manager.routes'));\n";
  let idx=app.indexOf("app.use('/api/");
  if(idx<0) idx=app.indexOf('module.exports');
  if(idx<0) throw new Error('Ponto de montagem da API do Gerenciador não encontrado');
  app=app.slice(0,idx)+block+'\n'+app.slice(idx);
  fs.writeFileSync(appPath,app);
}
console.log('Sales Manager API V2 aplicada.');