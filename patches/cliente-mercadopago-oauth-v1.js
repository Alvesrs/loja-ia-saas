const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/services/mercadoPagoOAuth.service.js', `
const crypto=require('node:crypto');
const supabase=require('../config/supabase');

function cfg(){
  return {
    clientId:String(process.env.MP_CLIENT_ID||'').trim(),
    clientSecret:String(process.env.MP_CLIENT_SECRET||'').trim(),
    redirectUri:String(process.env.MP_REDIRECT_URI||'').trim(),
    returnUrl:String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/cliente-central.html').trim()
  };
}
function configurado(){const c=cfg();return Boolean(c.clientId&&c.clientSecret&&c.redirectUri);}
function b64url(buf){return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');}
function random(n=32){return b64url(crypto.randomBytes(n));}

async function iniciar({lojaId,usuarioId}){
  const c=cfg();
  if(!configurado()) throw new Error('mp_nao_configurado');
  const state=random(32);
  const verifier=random(48);
  const challenge=b64url(crypto.createHash('sha256').update(verifier).digest());
  const expira=new Date(Date.now()+15*60*1000).toISOString();
  const {error}=await supabase.from('saintsai_pagamento_oauth_states').insert({
    state,loja_id:lojaId,usuario_id:usuarioId,provedor:'mercadopago',code_verifier:verifier,expira_em:expira
  });
  if(error) throw error;
  const u=new URL('https://auth.mercadopago.com/authorization');
  u.searchParams.set('client_id',c.clientId);
  u.searchParams.set('response_type','code');
  u.searchParams.set('platform_id','mp');
  u.searchParams.set('redirect_uri',c.redirectUri);
  u.searchParams.set('state',state);
  u.searchParams.set('code_challenge',challenge);
  u.searchParams.set('code_challenge_method','S256');
  return {url:u.toString()};
}

async function trocarCodigo({code,state}){
  const c=cfg();
  if(!configurado()) throw new Error('mp_nao_configurado');
  const {data:st,error}=await supabase.from('saintsai_pagamento_oauth_states').select('*').eq('state',state).eq('provedor','mercadopago').maybeSingle();
  if(error) throw error;
  if(!st) throw new Error('state_invalido');
  if(new Date(st.expira_em).getTime()<Date.now()){
    await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);
    throw new Error('state_expirado');
  }
  await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);

  const resp=await fetch('https://api.mercadopago.com/oauth/token',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({
      client_id:c.clientId,
      client_secret:c.clientSecret,
      grant_type:'authorization_code',
      code:String(code||''),
      redirect_uri:c.redirectUri,
      code_verifier:st.code_verifier
    })
  });
  const txt=await resp.text();
  let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}
  if(!resp.ok||!body.access_token) {
    const e=new Error('mp_token_falhou');e.status=resp.status;e.body=body;throw e;
  }

  const segredo=JSON.stringify({
    access_token:String(body.access_token),
    refresh_token:body.refresh_token?String(body.refresh_token):null,
    token_type:body.token_type||'bearer',
    scope:body.scope||null,
    user_id:body.user_id?String(body.user_id):null,
    public_key:body.public_key||null,
    live_mode:Boolean(body.live_mode),
    expires_in:Number(body.expires_in||0),
    obtido_em:new Date().toISOString()
  });

  const {data:atual}=await supabase.from('saintsai_pagamento_config').select('provedor_secret_id').eq('loja_id',st.loja_id).maybeSingle();
  const {data:secretId,error:ev}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:st.loja_id,p_secret:segredo});
  if(ev) throw ev;
  const expiraEm=body.expires_in?new Date(Date.now()+Number(body.expires_in)*1000).toISOString():null;
  const payload={
    loja_id:st.loja_id,provedor:'mercadopago',conectado:true,
    provedor_secret_id:secretId,provedor_ambiente:body.live_mode?'producao':'sandbox',
    provedor_status:'CONECTADO',provedor_usuario_id:body.user_id?String(body.user_id):null,
    provedor_public_key:body.public_key||null,token_expira_em:expiraEm,
    provedor_conta_resumo:'Mercado Pago conectado',aceita_pix_online:true,
    atualizado_em:new Date().toISOString()
  };
  const {error:eu}=await supabase.from('saintsai_pagamento_config').upsert(payload,{onConflict:'loja_id'});
  if(eu){
    await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId});
    throw eu;
  }
  if(atual?.provedor_secret_id&&atual.provedor_secret_id!==secretId){
    await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:atual.provedor_secret_id});
  }
  return {lojaId:st.loja_id,returnUrl:c.returnUrl};
}

module.exports={configurado,iniciar,trocarCodigo};
`);

write('src/controllers/mercadoPagoOAuth.controller.js', `
const supabase=require('../config/supabase');
const mp=require('../services/mercadoPagoOAuth.service');

async function iniciar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).eq('dono_id',req.usuario.id).maybeSingle();
    if(error)throw error;
    if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});
    const r=await mp.iniciar({lojaId,usuarioId:req.usuario.id});
    return res.json(r);
  }catch(e){
    if(e.message==='mp_nao_configurado')return res.status(503).json({erro:'Mercado Pago ainda precisa das credenciais da aplicação SaintsAI.'});
    console.error('[mp-oauth] iniciar',e?.message||e);
    return res.status(500).json({erro:'Não foi possível iniciar a conexão com Mercado Pago.'});
  }
}

async function callback(req,res){
  const okUrl=(base,params)=>{const u=new URL(base);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));return u.toString();};
  try{
    if(req.query?.error){
      const base=String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/cliente-central.html');
      return res.redirect(302,okUrl(base,{mp:'erro',motivo:String(req.query.error)}));
    }
    const code=String(req.query?.code||'');
    const state=String(req.query?.state||'');
    if(!code||!state)return res.status(400).send('Autorização do Mercado Pago inválida.');
    const r=await mp.trocarCodigo({code,state});
    return res.redirect(302,okUrl(r.returnUrl,{mp:'conectado'}));
  }catch(e){
    console.error('[mp-oauth] callback',e?.message||e);
    const base=String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/cliente-central.html');
    return res.redirect(302,okUrl(base,{mp:'erro'}));
  }
}
module.exports={iniciar,callback};
`);

write('src/routes/mercadoPagoOAuth.routes.js', `
const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/mercadoPagoOAuth.controller');
const r=express.Router();
r.get('/callback',c.callback);
r.post('/lojas/:lojaId/iniciar',exigirLogin,c.iniciar);
module.exports=r;
`);

let app=read('src/app.js');
if(!app.includes("mercadoPagoOAuthRoutes")){
  const anchor="const adminRoutes = require('./routes/admin.routes');";
  if(!app.includes(anchor))throw new Error('Anchor de require não encontrado');
  app=app.replace(anchor,anchor+"\nconst mercadoPagoOAuthRoutes = require('./routes/mercadoPagoOAuth.routes');");
  const use="app.use('/api/admin', adminRoutes);";
  if(!app.includes(use))throw new Error('Anchor admin use não encontrado');
  app=app.replace(use,use+"\napp.use('/api/pagamentos/mercadopago', mercadoPagoOAuthRoutes);");
}
write('src/app.js',app);

let h=read('public/cliente-central.html');
h=h.replace(
  '<option value="">Escolher depois</option><option value="asaas">Asaas</option><option value="stripe">Stripe</option><option value="outro">Outro</option>',
  '<option value="">Escolher depois</option><option value="mercadopago">Mercado Pago</option><option value="asaas">Asaas</option><option value="outro">Outro</option>'
);
h=h.replace(
  '<div id="p-conexao" class="notice" style="margin-top:14px">Pagamento automático não conectado.</div><div class="field"><label>Chave API do Asaas</label>',
  '<div id="p-conexao" class="notice" style="margin-top:14px">Pagamento automático não conectado.</div><div class="row" style="margin-top:14px"><button class="btn" id="p-mp-connect">Conectar Mercado Pago</button></div><div class="field"><label>Chave API do Asaas</label>'
);
h=h.replace(
  '<button class="btn2" id="p-connect">Conectar Asaas</button>',
  '<button class="btn2" id="p-connect">Conectar Asaas</button>'
);
if(!h.includes("p-mp-connect').onclick")){
  h=h.replace(
    "$('p-connect').onclick=async()=>{",
    "$('p-mp-connect').onclick=async()=>{try{$('p-mp-connect').disabled=true;$('p-status').textContent='Abrindo autorização do Mercado Pago…';const x=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('URL de autorização não recebida.');location.href=x.url;}catch(e){$('p-status').textContent=e.message||'Não foi possível iniciar a conexão.';$('p-mp-connect').disabled=false;}};\n$('p-connect').onclick=async()=>{"
  );
}
h=h.replace(
  "carregar();",
  "const mpRetorno=new URLSearchParams(location.search).get('mp');if(mpRetorno==='conectado'){setTimeout(()=>{$('p-status').textContent='Mercado Pago conectado com sucesso.';trocar('pagamentos');},250);}else if(mpRetorno==='erro'){setTimeout(()=>{$('p-status').textContent='A conexão com Mercado Pago não foi concluída.';trocar('pagamentos');},250);}carregar();"
);
write('public/cliente-central.html',h);

console.log('Mercado Pago OAuth + PKCE aplicado ao SaintsAI Cliente.');
