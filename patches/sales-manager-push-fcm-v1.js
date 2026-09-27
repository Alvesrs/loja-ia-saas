const fs=require('node:fs');

const routePath='sales-manager-runtime/sales-manager.routes.js';
let r=fs.readFileSync(routePath,'utf8');

if(!r.includes("const admin=require('firebase-admin');")){
  r=r.replace("const express = require('express');","const express = require('express');\nconst admin=require('firebase-admin');");
}

if(!r.includes('function firebaseApp(){')){
  const anchor="const addMonths = (d,n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+n, 1));";
  const helper=`
function firebaseApp(){
  if(admin.apps.length)return admin.app();
  const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)throw new Error('firebase_nao_configurado');
  const cfg=JSON.parse(raw);
  return admin.initializeApp({credential:admin.credential.cert(cfg)});
}
async function enviarPushVenda(empresaId,venda){
  const {data:devices,error}=await db.from('gv_push_devices').select('id,fcm_token').eq('empresa_id',empresaId).eq('ativo',true);
  if(error)throw error;
  if(!devices?.length)return;
  const valor=Number(venda.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const body=(venda.cliente_nome?String(venda.cliente_nome)+' · ':'')+valor;
  const messaging=firebaseApp().messaging();
  for(const d of devices){
    try{
      await messaging.send({
        token:d.fcm_token,
        data:{title:'Nova venda 💰',body,venda_id:String(venda.id||''),empresa_id:String(empresaId||'')},
        android:{priority:'high',notification:{channelId:'saintsai_sales'}}
      });
    }catch(e){
      console.error('[gv push]',e?.code||e?.message||e);
      if(String(e?.code||'').includes('registration-token-not-registered')){
        await db.from('gv_push_devices').update({ativo:false,atualizado_em:new Date().toISOString()}).eq('id',d.id);
      }
    }
  }
}
`;
  r=r.replace(anchor,anchor+'\n'+helper);
}

if(!r.includes("router.post('/push/device'")){
  const anchor="router.get('/vendas',requireUser,async(req,res)=>{";
  const block=`
router.post('/push/device',requireUser,async(req,res)=>{
  try{
    const fcm_token=String(req.body?.fcm_token||'').trim();
    if(fcm_token.length<20)return res.status(400).json({erro:'Token de notificação inválido.'});
    const payload={empresa_id:req.gv.empresa.id,user_id:req.gv.user.id,fcm_token,plataforma:'android',ativo:true,atualizado_em:new Date().toISOString()};
    const {error}=await db.from('gv_push_devices').upsert(payload,{onConflict:'fcm_token'});
    if(error)throw error;
    res.json({ok:true});
  }catch(e){console.error('[gv push register]',e);res.status(500).json({erro:'Não foi possível ativar notificações.'});}
});

router.delete('/push/device',requireUser,async(req,res)=>{
  try{
    const fcm_token=String(req.body?.fcm_token||'').trim();
    if(fcm_token)await db.from('gv_push_devices').update({ativo:false,atualizado_em:new Date().toISOString()}).eq('fcm_token',fcm_token).eq('user_id',req.gv.user.id);
    res.json({ok:true});
  }catch(e){res.status(500).json({erro:'Não foi possível desativar notificações.'});}
});

`;
  r=r.replace(anchor,block+anchor);
}

const needle="if(error) throw error; res.status(201).json({venda:data});";
if(r.includes(needle)&&!r.includes("enviarPushVenda(req.gv.empresa.id,data)")){
  r=r.replace(needle,"if(error) throw error; res.status(201).json({venda:data}); enviarPushVenda(req.gv.empresa.id,data).catch(e=>console.error('[gv push venda]',e?.message||e));");
}
fs.writeFileSync(routePath,r);

const htmlPath='sales-manager/public/index.html';
let h=fs.readFileSync(htmlPath,'utf8');
if(!h.includes('async function registrarPushNativo()')){
  h=h.replace("async function boot(){",`
async function registrarPushNativo(){
  try{
    if(!window.AndroidPush||typeof window.AndroidPush.getToken!=='function'||!sess?.access_token)return;
    const token=String(window.AndroidPush.getToken()||'').trim();
    if(token.length<20)return;
    await api('/push/device',{method:'POST',body:JSON.stringify({fcm_token:token})});
    localStorage.setItem('gv_push_token',token);
  }catch(e){console.warn('[push]',e)}
}
async function boot(){`);
  h=h.replace("await loadDashboard();}","await loadDashboard();setTimeout(registrarPushNativo,600);}",1);
  h=h.replace("await loadDashboard();\n  }catch(err)","await loadDashboard();setTimeout(registrarPushNativo,600);\n  }catch(err)");
}
fs.writeFileSync(htmlPath,h);

console.log('Push FCM do Gerenciador de Vendas aplicado.');
