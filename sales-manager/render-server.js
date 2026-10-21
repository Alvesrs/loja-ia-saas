'use strict';
const express = require('express');
const path = require('path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
app.get('/health',(_req,res)=>res.json({ok:true,app:'gerenciador-vendas',databaseConfigured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)}));
if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY){
  app.use('/api/gv',require('./sales-manager.routes'));
}else{
  app.use('/api/gv',(_req,res)=>res.status(503).json({erro:'Banco de dados ainda não conectado nesta hospedagem.'}));
}
const publicDir=path.join(__dirname,'public');
app.use('/gerenciador-vendas',express.static(publicDir));
app.use(express.static(publicDir));
app.get(['/','/gerenciador-vendas','/gerenciador-vendas/'],(_req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Gerenciador de Vendas Render online'));
