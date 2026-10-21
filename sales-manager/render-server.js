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

const appPath='/gerenciador-vendas/';
app.get('/gerenciador-vendas/manifest.webmanifest',(_req,res)=>res.type('application/manifest+json').json({
  id:appPath,name:'Gerenciador de Vendas',short_name:'Vendas',lang:'pt-BR',
  description:'Vendas, clientes, metas e relatórios da sua empresa.',
  start_url:appPath,scope:appPath,display:'standalone',background_color:'#10091c',theme_color:'#10091c',
  icons:[192,512].map(n=>({src:appPath+'icon-'+n+'.png',sizes:n+'x'+n,type:'image/png',purpose:'any maskable'}))
}));
const appIcons={"192":"iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAAD10lEQVR4nO3dPW7bQBSFUStI485I7T0YrrMlbyFVtuAtpTa8kawhBQEhcGFJvPPmxzynlglh5uMjkYjS6eH+8Q72+jb6DbA2AREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEfk++g1c5eX5ffRbGOD17Wn0W7jsNO1zYceM5hNz9jRdQLq5aKqSJgpIOjeZJKMpApLObsMzGhyQdJoYmNGwgKTT3JCMxvw7kHoqDFnVAQGpp07/te16CZNOHz2vZf0CUk9nfTLqdAlTT3991rxHQOoZpcPKlweknq/Nxzm+uOoTuDYg42cGpbtQGJB65lG3F1UBqWc2RTviHohISUDGz5wq9sUEItI+IONnZs13xwQi0jgg42d+bffIBCLSMiDjZxUNd8oEIiIgIs0Ccv1aS6v9MoGICIiIgIi0CcgN0Iqa7NoaXzC1qN9/flz5yl8//5a+kzouYVWur+fWF09FQCV2BLFoQwJqb3cKKzYkICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIh4svLu78XGIdR8CrGAC3fwwzYoP39Q5ekD7atDQ2aEDSjrQ0ObQAZETEBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARARFZ77GeI/wI10IWm0AH+RGuhawU0HF+hGshywR0qB/hWsgyATEnAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEVkmoN1f9vPJHyZfIFRx2BW/0KhNQK9vT02O87kd63vxT/btWcVh+9fTZNeWmUCbm1b5yhffunMVh11x9mxOD/ePTQ708vze5Dh0c8QJxGwERKRZQH3uo2ml1X6ZQEQERKRlQK5iq2i4UyYQkcYBGULza7tHJhCR9gEZQjNrvjsmEJGSgAyhOVXsiwl0FEVndVVAhtBBFE4gDc2jbi9qL2EamkHpLpTfA2lorOr1dxP9lXU4e3sEZAgN0WfZO00gDXXWbcGbfaj+Sj5730HP07X3PZBRVK3zCg+4idZQnf5r2/sSduZa1tao03JYQBsZNTFwqA8OaCOj3YbfD0wR0EZGNxmezmaigDYyumiSdDbTBXSmpA+m6uZs3oD+d8yY5izmgzUCYlr+N56IgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiMg/QyPP9yWzXp0AAAAASUVORK5CYII=","512":"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"};
app.get('/gerenciador-vendas/icon-:size.png',(req,res)=>{
  const icon=appIcons[req.params.size];if(!icon)return res.sendStatus(404);
  res.type('png').set('Cache-Control','public,max-age=86400').send(Buffer.from(icon,'base64'));
});
app.get('/gerenciador-vendas/sw.js',(_req,res)=>res.type('application/javascript').set('Cache-Control','no-cache').send("self.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));\nself.addEventListener('fetch',event=>{\n if(event.request.mode==='navigate'){\n  event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang=\"pt-BR\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Sem conexão</title><body style=\"background:#10091c;color:white;font:18px system-ui;padding:32px\"><h1>Você está sem conexão</h1><p>Conecte-se à internet para consultar ou registrar suas vendas.</p><button onclick=\"location.reload()\" style=\"padding:14px\">Tentar novamente</button></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})));\n }\n});"));

const publicDir=path.join(__dirname,'public');
app.use('/gerenciador-vendas',express.static(publicDir));
app.use(express.static(publicDir));
app.get(['/','/gerenciador-vendas','/gerenciador-vendas/'],(_req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Gerenciador de Vendas Render online'));
