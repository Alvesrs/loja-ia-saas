const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
write('src/controllers/pagBankWebhook.controller.js',"const pix=require('../services/pagBankPix.service');\nasync function webhook(req,res){\n  res.status(200).json({ok:true});\n  try{await pix.processarWebhook(req.body||{});}catch(e){console.error('[pagbank-webhook]',e?.message||e);}\n}\nmodule.exports={webhook};");
write('src/routes/pagBankWebhook.routes.js',"const express=require('express');\nconst c=require('../controllers/pagBankWebhook.controller');\nconst r=express.Router();\nr.post('/webhook',c.webhook);\nmodule.exports=r;");
let app=read('src/app.js');
if(!app.includes("pagBankWebhookRoutes")){
  const a="const pagBankConnectRoutes = require('./routes/pagBankConnect.routes');";
  if(!app.includes(a))throw new Error('Hook PagBank Connect não encontrado');
  app=app.replace(a,a+"\nconst pagBankWebhookRoutes = require('./routes/pagBankWebhook.routes');");
  const u="app.use('/api/pagamentos/pagbank', pagBankConnectRoutes);";
  if(!app.includes(u))throw new Error('Hook mount PagBank não encontrado');
  app=app.replace(u,u+"\napp.use('/api/pagamentos/pagbank', pagBankWebhookRoutes);");
}
write('src/app.js',app);
cp.execFileSync(process.execPath,['--check','src/controllers/pagBankWebhook.controller.js'],{stdio:'inherit'});
console.log('Webhook PagBank criado.');