const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
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
    webhookUrl:String(process.env.PAGBANK_WEBHOOK_URL||'').trim(),
    ambiente:String(process.env.PAGBANK_ENV||'production').trim()==='sandbox'?'sandbox':'production',
    returnUrl:String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://backend-prod-production-f338.up.railway.app/cliente/cliente-configuracao.html?etapa=pagamentos').trim()
  };
}
function faltantes(){
  const c=cfg(),out=[];
  if(!c.token)out.push('PAGBANK_PLATFORM_TOKEN');
  if(!c.clientId)out.push('PAGBANK_CLIENT_ID');
  if(!c.clientSecret)out.push('PAGBANK_CLIENT_SECRET');
  if(!c.redirectUri)out.push('PAGBANK_REDIRECT_URI');
  if(!c.webhookUrl)out.push('PAGBANK_WEBHOOK_URL');
  return out;
}
function configurado(){return faltantes().length===0;}
function base(c){return c.ambiente==='sandbox'?'https://sandbox.api.pagseguro.com':'https://api.pagseguro.com';}
function authBase(c){return c.ambiente==='sandbox'?'https://connect.sandbox.pagbank.com.br/oauth2/authorize':'https://connect.pagbank.com.br/oauth2/authorize';}
function random(){return crypto.randomBytes(32).toString('hex');}
function headers(c){return {'Authorization':'Bearer '+c.token,'X_CLIENT_ID':c.clientId,'X_CLIENT_SECRET':c.clientSecret,'Content-Type':'application/json','Accept':'application/json'};}
function segredoNormalizado(body,anterior={}){
  return {
    access_token:String(body.access_token||anterior.access_token||''),
    refresh_token:body.refresh_token?String(body.refresh_token):(anterior.refresh_token?String(anterior.refresh_token):null),
    token_type:body.token_type||anterior.token_type||'Bearer',
    expires_in:Number(body.expires_in||anterior.expires_in||0),
    scope:body.scope||anterior.scope||null,
    obtido_em:new Date().toISOString()
  };
}
function expiraEm(body){return body.expires_in?new Date(Date.now()+Number(body.expires_in)*1000).toISOString():null;}

async function statusPlataforma(){
  const c=cfg();
  return {configurado:configurado(),faltantes:faltantes(),ambiente:c.ambiente,redirect_uri:c.redirectUri||null,webhook_url:c.webhookUrl||null};
}

async function iniciar({lojaId,usuarioId}){
  const c=cfg();
  if(!configurado()){const e=new Error('pagbank_nao_configurado');e.faltantes=faltantes();throw e;}
  const state=random();
  const expira=new Date(Date.now()+10*60*1000).toISOString();
  const {error}=await supabase.from('saintsai_pagamento_oauth_states').insert({
    state,loja_id:lojaId,usuario_id:usuarioId,provedor:'pagbank',code_verifier:'not_used',expira_em:expira
  });
  if(error)throw error;
  const u=new URL(authBase(c));
  u.searchParams.set('response_type','code');
  u.searchParams.set('client_id',c.clientId);
  u.searchParams.set('redirect_uri',c.redirectUri);
  u.searchParams.set('scope','payments.read payments.create accounts.read');
  u.searchParams.set('state',state);
  return {url:u.toString()};
}

async function salvarSegredo(lojaId,body,anteriorSecretId=null,anterior={}){
  const segredo=segredoNormalizado(body,anterior);
  if(!segredo.access_token)throw new Error('pagbank_token_ausente');
  const {data:secretId,error:ev}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:lojaId,p_secret:JSON.stringify(segredo)});
  if(ev)throw ev;
  const payload={
    loja_id:lojaId,provedor:'pagbank',conectado:true,provedor_secret_id:secretId,
    provedor_ambiente:cfg().ambiente,provedor_status:'CONECTADO',
    provedor_conta_resumo:'PagBank conectado',token_expira_em:expiraEm(body),
    aceita_pix_online:true,atualizado_em:new Date().toISOString()
  };
  const {error:eu}=await supabase.from('saintsai_pagamento_config').upsert(payload,{onConflict:'loja_id'});
  if(eu){await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId});throw eu;}
  if(anteriorSecretId&&anteriorSecretId!==secretId){
    await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:anteriorSecretId});
  }
  return segredo;
}

async function trocarCodigo({code,state}){
  const c=cfg();
  if(!configurado()){const e=new Error('pagbank_nao_configurado');e.faltantes=faltantes();throw e;}
  const {data:st,error}=await supabase.from('saintsai_pagamento_oauth_states').select('*').eq('state',state).eq('provedor','pagbank').maybeSingle();
  if(error)throw error;
  if(!st)throw new Error('state_invalido');
  if(new Date(st.expira_em).getTime()<Date.now()){
    await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);
    throw new Error('state_expirado');
  }

  const resp=await fetch(base(c)+'/oauth2/token',{
    method:'POST',headers:headers(c),
    body:JSON.stringify({grant_type:'authorization_code',code:String(code||''),redirect_uri:c.redirectUri})
  });
  const txt=await resp.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}
  if(!resp.ok||!body.access_token){const e=new Error('pagbank_token_falhou');e.status=resp.status;throw e;}

  const {data:atual}=await supabase.from('saintsai_pagamento_config').select('provedor_secret_id').eq('loja_id',st.loja_id).maybeSingle();
  await salvarSegredo(st.loja_id,body,atual?.provedor_secret_id||null,{});
  await supabase.from('saintsai_pagamento_oauth_states').delete().eq('state',state);
  return {lojaId:st.loja_id,returnUrl:c.returnUrl};
}

async function lerSegredo(pc){
  if(!pc?.provedor_secret_id)throw new Error('pagbank_token_ausente');
  const {data,error}=await supabase.rpc('saintsai_get_payment_secret',{p_secret_id:pc.provedor_secret_id});
  if(error)throw error;
  let sec={};try{sec=JSON.parse(String(data||'{}'));}catch(_){}
  return sec;
}

async function obterAccessTokenLoja(lojaId){
  const c=cfg();
  if(!configurado()){const e=new Error('pagbank_nao_configurado');e.faltantes=faltantes();throw e;}
  const {data:pc,error}=await supabase.from('saintsai_pagamento_config')
    .select('provedor,conectado,provedor_secret_id,token_expira_em')
    .eq('loja_id',lojaId).maybeSingle();
  if(error)throw error;
  if(!pc||pc.provedor!=='pagbank'||pc.conectado!==true||!pc.provedor_secret_id)throw new Error('pagbank_nao_conectado');

  const sec=await lerSegredo(pc);
  const exp=pc.token_expira_em?new Date(pc.token_expira_em).getTime():0;
  const aindaValido=sec.access_token&&(!exp||exp>Date.now()+5*60*1000);
  if(aindaValido)return String(sec.access_token);
  if(!sec.refresh_token)throw new Error('pagbank_refresh_ausente');

  const resp=await fetch(base(c)+'/oauth2/refresh',{
    method:'POST',headers:headers(c),
    body:JSON.stringify({grant_type:'refresh_token',refresh_token:String(sec.refresh_token)})
  });
  const txt=await resp.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}
  if(!resp.ok||!body.access_token){const e=new Error('pagbank_refresh_falhou');e.status=resp.status;throw e;}

  const novo=await salvarSegredo(lojaId,body,pc.provedor_secret_id,sec);
  return String(novo.access_token);
}

async function statusLoja(lojaId){
  const plataforma=await statusPlataforma();
  const {data:pc,error}=await supabase.from('saintsai_pagamento_config')
    .select('provedor,conectado,provedor_status,provedor_conta_resumo,provedor_ambiente,token_expira_em,aceita_pix_online')
    .eq('loja_id',lojaId).maybeSingle();
  if(error)throw error;
  return {
    plataforma,
    conectado:Boolean(pc&&pc.provedor==='pagbank'&&pc.conectado===true),
    status:pc?.provedor_status||null,
    resumo:pc?.provedor_conta_resumo||null,
    ambiente:pc?.provedor_ambiente||plataforma.ambiente,
    token_expira_em:pc?.token_expira_em||null,
    pix_online:Boolean(pc?.aceita_pix_online)
  };
}

module.exports={configurado,faltantes,statusPlataforma,statusLoja,iniciar,trocarCodigo,obterAccessTokenLoja};
`);

write('src/controllers/pagBankConnect.controller.js', `
const supabase=require('../config/supabase');
const supabaseAuth=require('../config/supabaseAuth');
const {usuarioEhAdmin}=require('../middleware/admin');
const svc=require('../services/pagBankConnect.service');

async function exigirAcesso(lojaId,usuario){
  const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).maybeSingle();
  if(error)throw error;if(!loja)return false;
  if(loja.dono_id===usuario.id)return true;
  if(usuarioEhAdmin(usuario)){
    try{const {data}=await supabaseAuth.auth.admin.getUserById(loja.dono_id);return data?.user?.app_metadata?.saintsai_managed===true;}catch(_){return false;}
  }
  return false;
}
async function iniciar(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await exigirAcesso(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.json(await svc.iniciar({lojaId,usuarioId:req.usuario.id}));
  }catch(e){
    if(e.message==='pagbank_nao_configurado')return res.status(503).json({erro:'A integração PagBank do SaintsAI ainda não foi ativada.',faltantes:e.faltantes||[]});
    console.error('[pagbank-connect] iniciar',e?.message||e);
    return res.status(500).json({erro:'Não foi possível iniciar a conexão com PagBank.'});
  }
}
async function status(req,res){
  try{
    const lojaId=String(req.params.lojaId||'');
    if(!(await exigirAcesso(lojaId,req.usuario)))return res.status(403).json({erro:'Você não tem acesso a essa loja.'});
    return res.json(await svc.statusLoja(lojaId));
  }catch(e){console.error('[pagbank-connect] status',e?.message||e);return res.status(500).json({erro:'Não foi possível consultar o PagBank.'});}
}
async function callback(req,res){
  const voltar=(status)=>{const base=String(process.env.SAINTSAI_CLIENT_RETURN_URL||'https://backend-prod-production-f338.up.railway.app/cliente/cliente-configuracao.html?etapa=pagamentos');const u=new URL(base);u.searchParams.set('pagbank',status);return u.toString();};
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
module.exports={iniciar,status,callback};
`);

write('src/routes/pagBankConnect.routes.js', `
const express=require('express');
const {exigirLogin}=require('../middleware/auth');
const c=require('../controllers/pagBankConnect.controller');
const r=express.Router();
r.get('/callback',c.callback);
r.get('/lojas/:lojaId/status',exigirLogin,c.status);
r.post('/lojas/:lojaId/iniciar',exigirLogin,c.iniciar);
module.exports=r;
`);

let pix=read('src/services/pagBankPix.service.js');
if(!pix.includes("const connect=require('./pagBankConnect.service');")){
  pix=pix.replace("const supabase=require('../config/supabase');","const supabase=require('../config/supabase');\nconst connect=require('./pagBankConnect.service');");
}
const a=pix.indexOf('async function tokenLoja(lojaId){');
const b=pix.indexOf('\nfunction cents',a);
if(a<0||b<0)throw new Error('tokenLoja PagBank não encontrado');
pix=pix.slice(0,a)+"async function tokenLoja(lojaId){return connect.obterAccessTokenLoja(lojaId);}\n"+pix.slice(b);
write('src/services/pagBankPix.service.js',pix);

/* UI: status real da plataforma e da conta */
let h=read('public/cliente-configuracao.html');
const p0=h.indexOf('function renderPagamentos(){');
const p1=h.indexOf('\nfunction renderAgenda(){',p0);
if(p0<0||p1<0)throw new Error('renderPagamentos não encontrado');
const render=`function renderPagamentos(){
 const p=resumo.pagamentos||{};
 $('content').innerHTML='<h2>PagBank e formas de pagamento</h2><p class="muted">Conecte a conta PagBank da empresa para receber Pix online diretamente nessa conta.</p><div class="notice" id="pb-health">Verificando integração PagBank…</div><div class="checks"><label class="check"><input id="p-din" type="checkbox"> Dinheiro</label><label class="check"><input id="p-pixp" type="checkbox"> Pix presencial</label><label class="check"><input id="p-cart" type="checkbox"> Cartão presencial</label><label class="check"><input id="p-pixo" type="checkbox"> Pix online / automático</label><label class="check"><input id="p-antec" type="checkbox"> Exigir pagamento antecipado</label></div><div class="row"><div class="field"><label>Sinal</label><select id="p-sinal-t"><option value="nenhum">Sem sinal</option><option value="fixo">Valor fixo</option><option value="percentual">Percentual</option></select></div><div class="field"><label>Valor do sinal</label><input id="p-sinal-v" type="number" min="0" step=".01"></div></div><div class="btns"><button class="btn" id="p-save">Salvar formas</button><button class="btn secondary" id="p-pagbank">Conectar PagBank</button></div><div class="status" id="p-status"></div>';
 $('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);
 const q=new URLSearchParams(location.search).get('pagbank');if(q==='conectado')$('p-status').textContent='PagBank conectado com sucesso.';else if(q==='erro')$('p-status').textContent='A autorização do PagBank não foi concluída.';
 (async()=>{try{const st=await apiFetch('/pagamentos/pagbank/lojas/'+loja.id+'/status');const health=$('pb-health'),btn=$('p-pagbank');if(!st.plataforma?.configurado){health.textContent='A integração PagBank do SaintsAI ainda precisa ser ativada pelo administrador.';btn.disabled=true;btn.textContent='PagBank aguardando ativação';}else if(st.conectado){health.textContent='PagBank conectado · '+String(st.ambiente||'production');btn.textContent='Reconectar PagBank';}else{health.textContent='PagBank disponível para conexão.';btn.textContent='Conectar PagBank';}}catch(e){$('pb-health').textContent='Não foi possível verificar o PagBank agora.';}})();
 $('p-save').onclick=async()=>{const st=$('p-status');try{st.textContent='Salvando…';const np=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:p.provedor||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});resumo.pagamentos={...p,...np};st.textContent='Formas de pagamento salvas.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};
 $('p-pagbank').onclick=async()=>{const st=$('p-status'),b=$('p-pagbank');try{b.disabled=true;st.textContent='Abrindo autorização segura do PagBank…';const x=await apiFetch('/pagamentos/pagbank/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('Não foi possível abrir a autorização.');location.href=x.url;}catch(e){st.textContent=e.message||'Não foi possível iniciar a conexão.';b.disabled=false;}};
}
`;
h=h.slice(0,p0)+render+h.slice(p1);
write('public/cliente-configuracao.html',h);

for(const p of ['src/services/pagBankConnect.service.js','src/controllers/pagBankConnect.controller.js','src/routes/pagBankConnect.routes.js','src/services/pagBankPix.service.js']){
  cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}
const html=read('public/cliente-configuracao.html');
const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-pagbank-v2-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
console.log('PagBank Connect v2: status, OAuth e refresh token aplicados.');
