const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

write('src/services/pagBankConnect.service.js', `
const crypto=require('node:crypto');
const supabase=require('../config/supabase');

function cfg(){
  return {
    token:String(process.env.PAGBANK_PLATFORM_TOKEN||'').trim(),
    clientId:String(process.env.PAGBANK_CLIENT_ID||'').trim(),
    clientSecret:String(process.env.PAGBANK_CLIENT_SECRET||'').trim(),
    redirectUri:String(process.env.PAGBANK_REDIRECT_URI||'').trim(),
    ambiente:String(process.env.PAGBANK_ENV||'production').trim()==='sandbox'?'sandbox':'production',
    returnUrl:String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/cliente-central.html').trim()
  };
}
function configurado(){const c=cfg();return Boolean(c.token&&c.clientId&&c.clientSecret&&c.redirectUri);}
function base(c){return c.ambiente==='sandbox'?'https://sandbox.api.pagseguro.com':'https://api.pagseguro.com';}
function authBase(c){return c.ambiente==='sandbox'?'https://connect.sandbox.pagbank.com.br/oauth2/authorize':'https://connect.pagbank.com.br/oauth2/authorize';}
function random(){return crypto.randomBytes(32).toString('hex');}

async function iniciar({lojaId,usuarioId}){
  const c=cfg();if(!configurado())throw new Error('pagbank_nao_configurado');
  const state=random();
  const expira=new Date(Date.now()+15*60*1000).toISOString();
  const {error}=await supabase.from('saintsai_pagamento_oauth_states').insert({
    state,loja_id:lojaId,usuario_id:usuarioId,provedor:'pagbank',code_verifier:'not_used',expira_em:expira
  });
  if(error)throw error;
  const u=new URL(authBase(c));
  u.searchParams.set('response_type','code');
  u.searchParams.set('client_id',c.clientId);
  u.searchParams.set('redirect_uri',c.redirectUri);
  u.searchParams.set('scope','payments.read payments.create');
  u.searchParams.set('state',state);
  return {url:u.toString()};
}

async function trocarCodigo({code,state}){
  const c=cfg();if(!configurado())throw new Error('pagbank_nao_configurado');
  const {data:st,error}=await supabase.from('saintsai_pagamento_oauth_states').select('*').eq('state',state).eq('provedor','pagbank').maybeSingle();
  if(error)throw error;
  if(!st)throw new Error('state_invalido');
  if(new Date(st.expira_em).getTime()<Date.now()){
    await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);
    throw new Error('state_expirado');
  }
  await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);

  const resp=await fetch(base(c)+'/oauth2/token',{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+c.token,
      'X_CLIENT_ID':c.clientId,
      'X_CLIENT_SECRET':c.clientSecret,
      'Content-Type':'application/json',
      'Accept':'application/json'
    },
    body:JSON.stringify({grant_type:'authorization_code',code:String(code||''),redirect_uri:c.redirectUri})
  });
  const txt=await resp.text();
  let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}
  if(!resp.ok||!body.access_token){const e=new Error('pagbank_token_falhou');e.status=resp.status;e.body=body;throw e;}

  const segredo=JSON.stringify({
    access_token:String(body.access_token),
    refresh_token:body.refresh_token?String(body.refresh_token):null,
    token_type:body.token_type||'Bearer',
    expires_in:Number(body.expires_in||0),
    scope:body.scope||null,
    obtido_em:new Date().toISOString()
  });
  const {data:atual}=await supabase.from('saintsai_pagamento_config').select('provedor_secret_id').eq('loja_id',st.loja_id).maybeSingle();
  const {data:secretId,error:ev}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:st.loja_id,p_secret:segredo});
  if(ev)throw ev;
  const expiraEm=body.expires_in?new Date(Date.now()+Number(body.expires_in)*1000).toISOString():null;
  const payload={
    loja_id:st.loja_id,provedor:'pagbank',conectado:true,provedor_secret_id:secretId,
    provedor_ambiente:c.ambiente,provedor_status:'CONECTADO',
    provedor_conta_resumo:'PagBank conectado',token_expira_em:expiraEm,
    aceita_pix_online:true,atualizado_em:new Date().toISOString()
  };
  const {error:eu}=await supabase.from('saintsai_pagamento_config').upsert(payload,{onConflict:'loja_id'});
  if(eu){await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId});throw eu;}
  if(atual?.provedor_secret_id&&atual.provedor_secret_id!==secretId){
    await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:atual.provedor_secret_id});
  }
  return {lojaId:st.loja_id,returnUrl:c.returnUrl};
}

module.exports={configurado,iniciar,trocarCodigo};
`);

write('src/controllers/pagBankConnect.controller.js', `
const supabase=require('../config/supabase');
const svc=require('../services/pagBankConnect.service');

async function iniciar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).eq('dono_id',req.usuario.id).maybeSingle();
    if(error)throw error;
    if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});
    return res.json(await svc.iniciar({lojaId,usuarioId:req.usuario.id}));
  }catch(e){
    if(e.message==='pagbank_nao_configurado')return res.status(503).json({erro:'PagBank ainda precisa das credenciais da aplicação SaintsAI.'});
    console.error('[pagbank-connect] iniciar',e?.message||e);
    return res.status(500).json({erro:'Não foi possível iniciar a conexão com PagBank.'});
  }
}

async function callback(req,res){
  const voltar=(status)=>{const base=String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://ldpiryzsunxwuhyvvogg.supabase.co/functions/v1/saintsai-proxy/painel/cliente-central.html');const u=new URL(base);u.searchParams.set('pagbank',status);return u.toString();};
  try{
    if(req.query?.error)return res.redirect(302,voltar('erro'));
    const code=String(req.query?.code||'');const state=String(req.query?.state||'');
    if(!code||!state)return res.status(400).send('Autorização do PagBank inválida.');
    await svc.trocarCodigo({code,state});
    return res.redirect(302,voltar('conectado'));
  }catch(e){
    console.error('[pagbank-connect] callback',e?.message||e);
    return res.redirect(302,voltar('erro'));
  }
}
module.exports={iniciar,callback};
`);

write('src/routes/pagBankConnect.routes.js', `
const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/pagBankConnect.controller');
const r=express.Router();
r.get('/callback',c.callback);
r.post('/lojas/:lojaId/iniciar',exigirLogin,c.iniciar);
module.exports=r;
`);

let app=read('src/app.js');
if(!app.includes("pagBankConnectRoutes")){
  const anchor="const adminRoutes = require('./routes/admin.routes');";
  if(!app.includes(anchor))throw new Error('Anchor require não encontrado');
  app=app.replace(anchor,anchor+"\nconst pagBankConnectRoutes = require('./routes/pagBankConnect.routes');");
  const use="app.use('/api/admin', adminRoutes);";
  if(!app.includes(use))throw new Error('Anchor use não encontrado');
  app=app.replace(use,use+"\napp.use('/api/pagamentos/pagbank', pagBankConnectRoutes);");
}
write('src/app.js',app);

let h=read('public/cliente-central.html');
h=h.replace(
  '<option value="">Escolher depois</option><option value="mercadopago">Mercado Pago</option><option value="asaas">Asaas</option><option value="outro">Outro</option>',
  '<option value="">Escolher depois</option><option value="pagbank">PagBank</option><option value="asaas">Asaas</option><option value="mercadopago">Mercado Pago (futuro)</option><option value="outro">Outro</option>'
);
h=h.replace(
  '<div class="row" style="margin-top:14px"><button class="btn" id="p-mp-connect">Conectar Mercado Pago</button></div>',
  '<div class="row" style="margin-top:14px"><button class="btn" id="p-pagbank-connect">Conectar PagBank</button></div>'
);
h=h.replace(
  "$('p-mp-connect').onclick=async()=>{try{$('p-mp-connect').disabled=true;$('p-status').textContent='Abrindo autorização do Mercado Pago…';const x=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('URL de autorização não recebida.');location.href=x.url;}catch(e){$('p-status').textContent=e.message||'Não foi possível iniciar a conexão.';$('p-mp-connect').disabled=false;}};",
  "$('p-pagbank-connect').onclick=async()=>{try{$('p-pagbank-connect').disabled=true;$('p-status').textContent='Abrindo autorização do PagBank…';const x=await apiFetch('/pagamentos/pagbank/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('URL de autorização não recebida.');location.href=x.url;}catch(e){$('p-status').textContent=e.message||'Não foi possível iniciar a conexão.';$('p-pagbank-connect').disabled=false;}};"
);
h=h.replace(
  "const mpRetorno=new URLSearchParams(location.search).get('mp');if(mpRetorno==='conectado'){setTimeout(()=>{$('p-status').textContent='Mercado Pago conectado com sucesso.';trocar('pagamentos');},250);}else if(mpRetorno==='erro'){setTimeout(()=>{$('p-status').textContent='A conexão com Mercado Pago não foi concluída.';trocar('pagamentos');},250);}carregar();",
  "const qs=new URLSearchParams(location.search);const pb=qs.get('pagbank');if(pb==='conectado'){setTimeout(()=>{$('p-status').textContent='PagBank conectado com sucesso.';trocar('pagamentos');},250);}else if(pb==='erro'){setTimeout(()=>{$('p-status').textContent='A conexão com PagBank não foi concluída.';trocar('pagamentos');},250);}carregar();"
);
write('public/cliente-central.html',h);

console.log('PagBank Connect por empresa aplicado.');
