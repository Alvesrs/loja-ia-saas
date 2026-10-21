'use strict';
const express = require('express');
const path = require('path');
const app = express();
const apiBase='https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/gerenciador-vendas-api';
app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
app.get('/health',async(_req,res)=>{
  try {
    const upstream=await fetch(apiBase+'/health',{signal:AbortSignal.timeout(15000)});
    const health=await upstream.json();
    res.status(upstream.ok&&health.ok?200:503).json({ok:upstream.ok&&health.ok,app:'gerenciador-vendas',databaseConfigured:upstream.ok&&health.ok,api:'supabase-edge'});
  } catch {res.status(503).json({ok:false,app:'gerenciador-vendas',databaseConfigured:false});}
});
app.use('/api/gv',async(req,res)=>{
  try {
    const headers={'Content-Type':'application/json'};
    if(req.headers.authorization)headers.Authorization=req.headers.authorization;
    const options={method:req.method,headers,signal:AbortSignal.timeout(55000)};
    if(!['GET','HEAD'].includes(req.method))options.body=JSON.stringify(req.body||{});
    const upstream=await fetch(apiBase+req.originalUrl,options);
    res.status(upstream.status);
    for(const key of ['content-type','content-disposition','cache-control']){
      const value=upstream.headers.get(key);if(value)res.setHeader(key,value);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }catch{res.status(502).json({erro:'Não foi possível acessar o banco. Tente novamente em instantes.'});}
});
const publicDir=path.join(__dirname,'public');
app.use('/gerenciador-vendas',express.static(publicDir));
app.use(express.static(publicDir));
app.get(['/','/gerenciador-vendas','/gerenciador-vendas/'],(_req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Gerenciador de Vendas Render online'));
