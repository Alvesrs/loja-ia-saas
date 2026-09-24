const http=require('node:http');
const express=require('express');
const {createClient}=require('@supabase/supabase-js');

(async()=>{
  if(process.env.RAILWAY_SERVICE_NAME && process.env.RAILWAY_SERVICE_NAME!=='backend-prod'){
    console.log('[gv-smoke] skip em '+process.env.RAILWAY_SERVICE_NAME);
    return;
  }
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error('[gv-smoke] Supabase env ausente');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const stamp=Date.now();
  const adminEmail='gv-smoke-admin-'+stamp+'@example.invalid';
  const userEmail='gv-smoke-user-'+stamp+'@example.invalid';
  const pass='Smoke'+String(stamp).slice(-8)+'!Aa';
  let adminId=null,userId=null,empresaId=null,server=null;
  async function req(base,path,opt={}){
    const r=await fetch(base+path,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});
    const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
    if(!r.ok) throw new Error(path+' -> '+r.status+' '+JSON.stringify(body));
    return {status:r.status,body};
  }
  try{
    const a=await db.auth.admin.createUser({email:adminEmail,password:pass,email_confirm:true});
    if(a.error||!a.data?.user) throw a.error||new Error('admin não criado');
    adminId=a.data.user.id;
    const u=await db.auth.admin.createUser({email:userEmail,password:pass,email_confirm:true});
    if(u.error||!u.data?.user) throw u.error||new Error('usuário órfão não criado');
    userId=u.data.user.id;

    process.env.SAAS_ADMIN_EMAILS=adminEmail;
    const routerPath=require.resolve('../src/routes/sales-manager.routes');
    delete require.cache[routerPath];
    const router=require('../src/routes/sales-manager.routes');
    const app=express(); app.use(express.json()); app.use('/api/gv',router);
    server=http.createServer(app);
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
    const port=server.address().port,base='http://127.0.0.1:'+port;

    const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const si=await auth.auth.signInWithPassword({email:adminEmail,password:pass});
    if(si.error||!si.data?.session) throw si.error||new Error('login admin falhou');
    const ah={authorization:'Bearer '+si.data.session.access_token};

    const create=await req(base,'/api/gv/admin/contas',{method:'POST',headers:ah,body:JSON.stringify({empresa:'Empresa Smoke '+stamp,nome:'Responsável Smoke',email:userEmail,senha:pass})});
    if(create.status!==201||create.body.usuario_reaproveitado!==true) throw new Error('reuso do usuário não validado');
    empresaId=create.body.empresa?.id;if(!empresaId) throw new Error('empresa não criada');

    const login=await req(base,'/api/gv/login',{method:'POST',body:JSON.stringify({email:userEmail,senha:pass})});
    if(!login.body.access_token) throw new Error('token do Gerenciador ausente');
    const uh={authorization:'Bearer '+login.body.access_token};

    const ctx=await req(base,'/api/gv/contexto',{headers:uh});
    if(ctx.body.empresa?.id!==empresaId) throw new Error('contexto da empresa incorreto');

    const cli=await req(base,'/api/gv/clientes',{method:'POST',headers:uh,body:JSON.stringify({nome:'Cliente Smoke',telefone:'41999999999'})});
    if(!cli.body.cliente?.id) throw new Error('cliente não criado');

    const prod=await req(base,'/api/gv/produtos',{method:'POST',headers:uh,body:JSON.stringify({nome:'Produto Smoke',categoria:'Teste',preco:199.90,custo:80})});
    if(!prod.body.produto?.id) throw new Error('produto não criado');

    const sale=await req(base,'/api/gv/vendas',{method:'POST',headers:uh,body:JSON.stringify({cliente_nome:'Cliente Smoke',produto_id:prod.body.produto.id,produto_nome:'Produto Smoke',categoria:'Teste',origem:'WhatsApp',valor:199.90,custo:80})});
    if(!sale.body.venda?.id) throw new Error('venda não criada');

    const vendas=await req(base,'/api/gv/vendas?limit=10',{headers:uh});
    if(!(vendas.body.vendas||[]).some(v=>v.id===sale.body.venda.id)) throw new Error('venda não apareceu na listagem');

    const dash=await req(base,'/api/gv/dashboard',{headers:uh});
    if(Number(dash.body.metricas?.vendas)<1||Number(dash.body.metricas?.faturamento)<199.9) throw new Error('dashboard não refletiu a venda');

    console.log('[gv-smoke] PASS admin-create/reuse + login + contexto + cliente + produto + venda + dashboard');
  } finally {
    try{if(server) await new Promise(r=>server.close(r))}catch{}
    try{if(empresaId) await db.from('gv_empresas').delete().eq('id',empresaId)}catch{}
    try{if(userId) await db.auth.admin.deleteUser(userId)}catch{}
    try{if(adminId) await db.auth.admin.deleteUser(adminId)}catch{}
  }
})().catch(e=>{console.error('[gv-smoke] FAIL',e);process.exit(1)});