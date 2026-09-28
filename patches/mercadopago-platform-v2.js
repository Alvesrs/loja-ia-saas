const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
function mustReplace(s,a,b,label){
  if(!s.includes(a))throw new Error('Mercado Pago v2: '+label+' não encontrado');
  return s.replace(a,b);
}

/* 1) Evolui o OAuth já criado pelo patch anterior: status + refresh token. */
let oauth=read('src/services/mercadoPagoOAuth.service.js');
if(!oauth.includes("u.searchParams.set('scope','offline_access')")){
  oauth=mustReplace(
    oauth,
    "u.searchParams.set('state',state);",
    "u.searchParams.set('state',state);\n  u.searchParams.set('scope','offline_access');",
    'scope OAuth'
  );
}
if(!oauth.includes('async function obterAccessTokenLoja')){
  const exportOld="module.exports={configurado,iniciar,trocarCodigo};";
  const extra=[
    "",
    "function faltantes(){const c=cfg(),a=[];if(!c.clientId)a.push('MP_CLIENT_ID');if(!c.clientSecret)a.push('MP_CLIENT_SECRET');if(!c.redirectUri)a.push('MP_REDIRECT_URI');return a;}",
    "async function statusPlataforma(){const c=cfg();return {configurado:configurado(),faltantes:faltantes(),redirect_uri:c.redirectUri||null};}",
    "async function obterAccessTokenLoja(lojaId){",
    "  const c=cfg();",
    "  const {data:pc,error}=await supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',lojaId).maybeSingle();",
    "  if(error)throw error;",
    "  if(!pc||pc.provedor!=='mercadopago'||pc.conectado!==true||!pc.provedor_secret_id)throw new Error('mp_nao_conectado');",
    "  const {data,error:es}=await supabase.rpc('saintsai_get_payment_secret',{p_secret_id:pc.provedor_secret_id});",
    "  if(es)throw es;",
    "  let sec={};try{sec=JSON.parse(String(data||'{}'));}catch(_){}",
    "  if(!sec.access_token)throw new Error('mp_token_ausente');",
    "  const exp=pc.token_expira_em?new Date(pc.token_expira_em).getTime():0;",
    "  const renovar=Boolean(sec.refresh_token&&configurado()&&(!exp||exp-Date.now()<7*24*60*60*1000));",
    "  if(!renovar)return String(sec.access_token);",
    "  const resp=await fetch('https://api.mercadopago.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:c.clientId,client_secret:c.clientSecret,grant_type:'refresh_token',refresh_token:String(sec.refresh_token)})});",
    "  const txt=await resp.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}",
    "  if(!resp.ok||!body.access_token){if(exp&&exp>Date.now())return String(sec.access_token);throw new Error('mp_reautorizacao_necessessaria');}",
    "  const segredo=JSON.stringify({access_token:String(body.access_token),refresh_token:body.refresh_token?String(body.refresh_token):String(sec.refresh_token),token_type:body.token_type||sec.token_type||'bearer',scope:body.scope||sec.scope||null,user_id:body.user_id?String(body.user_id):(sec.user_id||null),public_key:body.public_key||sec.public_key||null,live_mode:typeof body.live_mode==='boolean'?body.live_mode:Boolean(sec.live_mode),expires_in:Number(body.expires_in||0),obtido_em:new Date().toISOString()});",
    "  const {data:secretId,error:ev}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:lojaId,p_secret:segredo});if(ev)throw ev;",
    "  const tokenExpira=body.expires_in?new Date(Date.now()+Number(body.expires_in)*1000).toISOString():null;",
    "  const {error:eu}=await supabase.from('saintsai_pagamento_config').update({provedor_secret_id:secretId,token_expira_em:tokenExpira,provedor_status:'CONECTADO',atualizado_em:new Date().toISOString()}).eq('loja_id',lojaId);",
    "  if(eu){try{await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId});}catch(_){}throw eu;}",
    "  try{await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:pc.provedor_secret_id});}catch(_){}",
    "  return String(body.access_token);",
    "}",
    "async function statusLoja(lojaId){",
    "  const plataforma=await statusPlataforma();",
    "  const {data:pc,error}=await supabase.from('saintsai_pagamento_config').select('provedor,conectado,provedor_status,provedor_conta_resumo,provedor_ambiente,token_expira_em,aceita_pix_online').eq('loja_id',lojaId).maybeSingle();",
    "  if(error)throw error;",
    "  const isMp=pc?.provedor==='mercadopago';",
    "  return {plataforma,conectado:Boolean(isMp&&pc?.conectado===true),status:isMp?(pc?.provedor_status||null):null,conta:isMp?(pc?.provedor_conta_resumo||null):null,ambiente:isMp?(pc?.provedor_ambiente||null):null,token_expira_em:isMp?(pc?.token_expira_em||null):null,pix_online:Boolean(isMp&&pc?.aceita_pix_online)};",
    "}",
    "module.exports={configurado,faltantes,statusPlataforma,statusLoja,iniciar,trocarCodigo,obterAccessTokenLoja};"
  ].join('\n');
  oauth=mustReplace(oauth,exportOld,extra,'export OAuth');
}
write('src/services/mercadoPagoOAuth.service.js',oauth);

let oc=read('src/controllers/mercadoPagoOAuth.controller.js');
if(!oc.includes('async function status(req,res)')){
  const callbackAnchor='async function callback(req,res){';
  const fn=[
    "async function status(req,res){",
    "  try{",
    "    const lojaId=String(req.params.lojaId||'');",
    "    const {data:loja,error}=await supabase.from('lojas').select('id,dono_id').eq('id',lojaId).eq('dono_id',req.usuario.id).maybeSingle();",
    "    if(error)throw error;if(!loja)return res.status(404).json({erro:'Loja não encontrada.'});",
    "    return res.json(await mp.statusLoja(lojaId));",
    "  }catch(e){console.error('[mp-oauth] status',e?.message||e);return res.status(500).json({erro:'Não foi possível consultar o Mercado Pago.'});}",
    "}",
    ""
  ].join('\n');
  oc=mustReplace(oc,callbackAnchor,fn+callbackAnchor,'controller status');
  oc=mustReplace(oc,"module.exports={iniciar,callback};","module.exports={iniciar,status,callback};",'controller export');
}
write('src/controllers/mercadoPagoOAuth.controller.js',oc);

let or=read('src/routes/mercadoPagoOAuth.routes.js');
if(!or.includes("'/lojas/:lojaId/status'")){
  or=mustReplace(or,"r.get('/callback',c.callback);","r.get('/callback',c.callback);\nr.get('/lojas/:lojaId/status',exigirLogin,c.status);",'route status');
}
write('src/routes/mercadoPagoOAuth.routes.js',or);

/* 2) Pix online por conta conectada, usando Payment API + OAuth da loja. */
write('src/services/mercadoPagoPix.service.js',[
"const crypto=require('node:crypto');",
"const supabase=require('../config/supabase');",
"const mp=require('./mercadoPagoOAuth.service');",
"const envio=require('./whatsappEnvio.service');",
"",
"function minutos(){return Math.max(30,Math.min(43200,Number(process.env.MP_PIX_EXPIRATION_MINUTES||30)));}",
"function emailValido(v){return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(v||'').trim());}",
"function expiraEm(){return new Date(Date.now()+minutos()*60000);}",
"",
"async function criarPixParaAgendamento(ag,servico,{email}={}){",
"  const payerEmail=String(email||'').trim().toLowerCase();",
"  if(!emailValido(payerEmail))throw new Error('mp_email_pagador_ausente');",
"  const token=await mp.obterAccessTokenLoja(ag.loja_id);",
"  const expira=expiraEm();",
"  const payload={transaction_amount:Number(Number(ag.valor||0).toFixed(2)),description:String(servico?.nome||'Agendamento SaintsAI').slice(0,200),payment_method_id:'pix',date_of_expiration:expira.toISOString(),external_reference:'saintsai-ag-'+ag.id,notification_url:String(process.env.MP_WEBHOOK_URL||'').trim()||undefined,payer:{email:payerEmail}};",
"  if(!payload.notification_url)delete payload.notification_url;",
"  const resp=await fetch('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(payload)});",
"  const txt=await resp.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}",
"  if(!resp.ok||!body.id){const e=new Error('mp_criar_pix_falhou');e.status=resp.status;e.body=body;throw e;}",
"  const td=body?.point_of_interaction?.transaction_data||{};const qrText=td.qr_code||null;const qr64=td.qr_code_base64||null;const ticketUrl=td.ticket_url||null;",
"  if(!qrText)throw new Error('mp_qr_ausente');",
"  const qrUrl=qr64?('data:image/png;base64,'+qr64):ticketUrl;",
"  const {error}=await supabase.from('saintsai_agendamentos').update({pagamento_referencia:String(body.id),pagamento_charge_id:String(body.id),pagamento_qr_text:String(qrText),pagamento_qr_url:qrUrl,pagamento_expira_em:expira.toISOString(),pagamento_provider_status:String(body.status||'pending'),pagamento_status:'aguardando',status:'pendente',atualizado_em:new Date().toISOString()}).eq('id',ag.id).eq('loja_id',ag.loja_id);",
"  if(error)throw error;return {qrText,qrUrl,ticketUrl,expiraEm:expira.toISOString()};",
"}",
"",
"async function consultarPagamento(lojaId,paymentId){",
"  const token=await mp.obterAccessTokenLoja(lojaId);",
"  const resp=await fetch('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(paymentId),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});",
"  const txt=await resp.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){}",
"  if(!resp.ok||!body.id)throw new Error('mp_consulta_falhou');return body;",
"}",
"",
"function formatarDataHora(inicio){const d=new Date(inicio);return {data:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d),hora:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};}",
"async function enviarConfirmacaoPagamento(ag){",
"  if(!ag?.id||!ag?.cliente_whatsapp)return false;const agora=new Date().toISOString();",
"  const {data:claim,error:ec}=await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:agora}).eq('id',ag.id).eq('loja_id',ag.loja_id).is('pagamento_confirmacao_enviada_em',null).select('id,loja_id,servico_id,cliente_whatsapp,inicio').maybeSingle();",
"  if(ec)throw ec;if(!claim)return false;",
"  try{",
"    const [{data:cfgs,error:e1},{data:sv,error:e2}]=await Promise.all([supabase.from('whatsapp_configuracoes').select('id,provedor,identificador_externo,ativo').eq('loja_id',claim.loja_id).eq('ativo',true).limit(10),claim.servico_id?supabase.from('saintsai_servicos').select('nome').eq('id',claim.servico_id).eq('loja_id',claim.loja_id).maybeSingle():Promise.resolve({data:null,error:null})]);",
"    if(e1||e2)throw(e1||e2);const cfg=(cfgs||[]).find(x=>x.provedor==='waha')||(cfgs||[]).find(x=>x.provedor==='meta')||(cfgs||[])[0];if(!cfg)throw new Error('sem_whatsapp');",
"    const f=formatarDataHora(claim.inicio),texto='Pagamento confirmado ✅ Seu agendamento de '+String(sv?.nome||'seu atendimento')+' está confirmado para '+f.data+' às '+f.hora+'.';",
"    const idExterno='agenda-mp-'+claim.id;const mensagem=Object.freeze({canal:'whatsapp',lojaId:claim.loja_id,configuracaoId:cfg.id,contato:claim.cliente_whatsapp,texto:'',idExterno,timestamp:new Date().toISOString()});const resposta=Object.freeze({lojaId:claim.loja_id,contato:claim.cliente_whatsapp,idExterno,resposta:texto});const contexto=Object.freeze({provedor:cfg.provedor,destinatarioId:cfg.identificador_externo});",
"    await envio.enviarRespostaWhatsapp(mensagem,resposta,contexto);return true;",
"  }catch(e){await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:null}).eq('id',claim.id).eq('loja_id',claim.loja_id);throw e;}",
"}",
"",
"async function aplicarStatus(ag,p){",
"  const ps=String(p.status||''),u={pagamento_provider_status:(ps+(p.status_detail?':'+p.status_detail:'')).slice(0,200),atualizado_em:new Date().toISOString()};",
"  if(ps==='approved'){u.pagamento_status='pago';u.pagamento_pago_em=new Date().toISOString();if(!['cancelado','nao_compareceu'].includes(String(ag.status||'')))u.status='confirmado';}",
"  else if(['cancelled','rejected'].includes(ps)){u.pagamento_status='cancelado';u.status='cancelado';}",
"  else if(ps==='refunded'||ps==='charged_back'){u.pagamento_status='estornado';u.status='cancelado';}",
"  const {data,error}=await supabase.from('saintsai_agendamentos').update(u).eq('id',ag.id).eq('loja_id',ag.loja_id).select('*').maybeSingle();if(error)throw error;",
"  if(ps==='approved'&&data&&data.status==='confirmado'){try{await enviarConfirmacaoPagamento(data);}catch(e){console.error('[mp-confirmacao]',e?.message||e);}}return data;",
"}",
"",
"async function processarWebhook(payload,query){",
"  const id=String(payload?.data?.id||query?.['data.id']||query?.data_id||payload?.id||'');if(!id)return {ignorado:true};",
"  const {data:ag,error}=await supabase.from('saintsai_agendamentos').select('*').or('pagamento_referencia.eq.'+id+',pagamento_charge_id.eq.'+id).eq('pagamento_metodo','pix_online').maybeSingle();if(error)throw error;if(!ag)return {ignorado:true};",
"  return {ok:true,agendamento:await aplicarStatus(ag,await consultarPagamento(ag.loja_id,id))};",
"}",
"",
"async function expirarReservas(){",
"  const {data,error}=await supabase.from('saintsai_agendamentos').select('*').eq('pagamento_metodo','pix_online').eq('pagamento_status','aguardando').eq('status','pendente').not('pagamento_expira_em','is',null).lte('pagamento_expira_em',new Date().toISOString()).limit(100);if(error)throw error;let n=0;",
"  for(const ag of data||[]){let pago=false;try{const p=await consultarPagamento(ag.loja_id,ag.pagamento_referencia);const a=await aplicarStatus(ag,p);pago=a?.pagamento_status==='pago';}catch(_){}if(!pago){const {error:e}=await supabase.from('saintsai_agendamentos').update({status:'cancelado',pagamento_status:'cancelado',pagamento_provider_status:'EXPIRED_LOCAL',atualizado_em:new Date().toISOString()}).eq('id',ag.id).eq('pagamento_status','aguardando');if(!e)n++;}}return n;",
"}",
"module.exports={criarPixParaAgendamento,processarWebhook,expirarReservas,enviarConfirmacaoPagamento};"
].join('\n'));

write('src/controllers/mercadoPagoWebhook.controller.js',[
"const pix=require('../services/mercadoPagoPix.service');",
"async function webhook(req,res){res.status(200).json({ok:true});try{await pix.processarWebhook(req.body||{},req.query||{});}catch(e){console.error('[mp-webhook]',e?.message||e);}}",
"module.exports={webhook};"
].join('\n'));
write('src/routes/mercadoPagoWebhook.routes.js',[
"const express=require('express');",
"const c=require('../controllers/mercadoPagoWebhook.controller');",
"const r=express.Router();",
"r.post('/webhook',c.webhook);",
"module.exports=r;"
].join('\n'));

let app=read('src/app.js');
if(!app.includes("mercadoPagoWebhookRoutes")){
  app=mustReplace(app,"const mercadoPagoOAuthRoutes = require('./routes/mercadoPagoOAuth.routes');","const mercadoPagoOAuthRoutes = require('./routes/mercadoPagoOAuth.routes');\nconst mercadoPagoWebhookRoutes = require('./routes/mercadoPagoWebhook.routes');",'require webhook');
  app=mustReplace(app,"app.use('/api/pagamentos/mercadopago', mercadoPagoOAuthRoutes);","app.use('/api/pagamentos/mercadopago', mercadoPagoOAuthRoutes);\napp.use('/api/pagamentos/mercadopago', mercadoPagoWebhookRoutes);",'mount webhook');
}
write('src/app.js',app);

/* O worker antigo do PagBank passa a apontar para o expirador Mercado Pago. */
write('src/services/pagBankPix.service.js',"module.exports=require('./mercadoPagoPix.service');\n");

/* 3) Fluxo de agendamento público: Mercado Pago + e-mail obrigatório somente no Pix online. */
let booking=read('src/services/bookingPublic.service.js');
booking=mustReplace(booking,"const pagBankPix=require('./pagBankPix.service');","const mercadoPagoPix=require('./mercadoPagoPix.service');",'booking require');
booking=booking.replace("c.provedor==='pagbank'","c.provedor==='mercadopago'");
booking=mustReplace(booking,"pixDados=await pagBankPix.criarPixParaAgendamento({...ag,loja_id:link.loja_id,valor:precoAtual},servico);","pixDados=await mercadoPagoPix.criarPixParaAgendamento({...ag,loja_id:link.loja_id,valor:precoAtual},servico,{email:String(body?.email||'').trim()});",'booking pix');
write('src/services/bookingPublic.service.js',booking);

let agenda=read('src/services/agendaWhatsapp.service.js');
agenda=mustReplace(agenda,"const pagBankPix=require('./pagBankPix.service');","const mercadoPagoPix=require('./mercadoPagoPix.service');",'agenda require');
agenda=agenda.replace(/pagCfg\?\.provedor==='pagbank'/g,"pagCfg?.provedor==='mercadopago'");
agenda=agenda.replace(/pag\?\.provedor==='pagbank'/g,"pag?.provedor==='mercadopago'");
agenda=agenda.replace(/pagBankPix\.criarPixParaAgendamento/g,"mercadoPagoPix.criarPixParaAgendamento");
const waitOld="if(estado.aguardando_pagamento_metodo){const n=normalizar(texto);if(/pix.*(agora|online)|^pix$/.test(n)){estado.pagamento_metodo='pix_online';estado.aguardando_pagamento_metodo=false;await salvarEstado(lojaId,contato,estado);}else if(/presencial|dinheiro|cartao|cartão|pagar.*local/.test(n)){estado.pagamento_metodo='presencial';estado.aguardando_pagamento_metodo=false;await salvarEstado(lojaId,contato,estado);}else return 'Você prefere pagar por PIX agora ou pagar presencialmente no atendimento?';}";
if(agenda.includes(waitOld)){
  const waitNew="if(estado.aguardando_email_pagador){const email=String(texto||'').trim().toLowerCase();if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return 'Para gerar o PIX pelo Mercado Pago, informe um e-mail válido.';estado.email_pagador=email;estado.aguardando_email_pagador=false;await salvarEstado(lojaId,contato,estado);}if(estado.aguardando_pagamento_metodo){const n=normalizar(texto);if(/pix.*(agora|online)|^pix$/.test(n)){estado.pagamento_metodo='pix_online';estado.aguardando_pagamento_metodo=false;estado.aguardando_email_pagador=true;await salvarEstado(lojaId,contato,estado);return 'Qual é o seu e-mail? O Mercado Pago solicita o e-mail do pagador para gerar o PIX.';}else if(/presencial|dinheiro|cartao|cartão|pagar.*local/.test(n)){estado.pagamento_metodo='presencial';estado.aguardando_pagamento_metodo=false;await salvarEstado(lojaId,contato,estado);}else return 'Você prefere pagar por PIX agora ou pagar presencialmente no atendimento?';}";
  agenda=agenda.replace(waitOld,waitNew);
}
agenda=agenda.replace("mercadoPagoPix.criarPixParaAgendamento({...data,loja_id:lojaId,valor:Number(servico.preco||0)},servico)","mercadoPagoPix.criarPixParaAgendamento({...data,loja_id:lojaId,valor:Number(servico.preco||0)},servico,{email:estado.email_pagador})");
write('src/services/agendaWhatsapp.service.js',agenda);

let agendar=read('public/agendar.html');
agendar=mustReplace(agendar,'<div class="field"><label>Seu nome</label><input id="nome" maxlength="100" autocomplete="name" placeholder="Nome para o agendamento"></div><div class="muted" style="margin-top:13px">Forma de pagamento</div>','<div class="field"><label>Seu nome</label><input id="nome" maxlength="100" autocomplete="name" placeholder="Nome para o agendamento"></div><div class="field hidden" id="email-field"><label>Seu e-mail</label><input id="email" maxlength="160" inputmode="email" autocomplete="email" placeholder="Necessário para gerar o Pix"></div><div class="muted" style="margin-top:13px">Forma de pagamento</div>','campo email');
agendar=mustReplace(agendar,"document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{pagamento=b.dataset.p;document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===pagamento));renderReview()});","document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{pagamento=b.dataset.p;document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===pagamento));$('email-field').classList.toggle('hidden',pagamento!=='pix_online');renderReview()});",'seletor pagamento');
agendar=mustReplace(agendar,"if(pagamento)document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===pagamento));renderReview()}","if(pagamento)document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===pagamento));$('email-field').classList.toggle('hidden',pagamento!=='pix_online');renderReview()}",'auto pagamento');
agendar=mustReplace(agendar,"$('confirmar').onclick=async()=>{const nome=$('nome').value.trim(),st=$('status');if(!servico||!dia||!hora)return st.textContent='Escolha serviço, profissional, dia e horário.';if(!nome)return st.textContent='Informe seu nome.';if(!pagamento)return st.textContent='Escolha a forma de pagamento.';","$('confirmar').onclick=async()=>{const nome=$('nome').value.trim(),email=$('email').value.trim().toLowerCase(),st=$('status');if(!servico||!dia||!hora)return st.textContent='Escolha serviço, profissional, dia e horário.';if(!nome)return st.textContent='Informe seu nome.';if(!pagamento)return st.textContent='Escolha a forma de pagamento.';if(pagamento==='pix_online'&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return st.textContent='Informe um e-mail válido para gerar o Pix pelo Mercado Pago.';",'validacao email');
agendar=mustReplace(agendar,"pagamento_metodo:pagamento,preco_revisado:servico.preco","pagamento_metodo:pagamento,email,preco_revisado:servico.preco",'envio email');
write('public/agendar.html',agendar);

/* 4) UI e onboarding agora falam apenas Mercado Pago. */
let hub=read('src/controllers/clienteHub.controller.js');
hub=hub.replace("id:'pagbank',titulo:'Conecte o PagBank',descricao:'Conecte sua conta PagBank para receber pagamentos online.'","id:'mercadopago',titulo:'Conecte o Mercado Pago',descricao:'Conecte sua conta Mercado Pago para receber pagamentos online.'");
write('src/controllers/clienteHub.controller.js',hub);

let cfgHtml=read('public/cliente-configuracao.html');
const p0=cfgHtml.indexOf('function renderPagamentos(){');
const p1=cfgHtml.indexOf('\nfunction renderAgenda(){',p0);
if(p0<0||p1<0)throw new Error('Mercado Pago v2: renderPagamentos não encontrado');
const render=[
"function renderPagamentos(){",
" const p=resumo.pagamentos||{};",
" $('content').innerHTML='<h2>Mercado Pago e formas de pagamento</h2><p class=\"muted\">Conecte a conta Mercado Pago da empresa. Cada estabelecimento recebe os pagamentos diretamente na própria conta.</p><div class=\"notice\" id=\"mp-health\">Verificando integração Mercado Pago…</div><div class=\"checks\"><label class=\"check\"><input id=\"p-din\" type=\"checkbox\"> Dinheiro</label><label class=\"check\"><input id=\"p-pixp\" type=\"checkbox\"> Pix presencial</label><label class=\"check\"><input id=\"p-cart\" type=\"checkbox\"> Cartão presencial</label><label class=\"check\"><input id=\"p-pixo\" type=\"checkbox\"> Pix online / automático</label><label class=\"check\"><input id=\"p-antec\" type=\"checkbox\"> Exigir pagamento antecipado</label></div><div class=\"row\"><div class=\"field\"><label>Sinal</label><select id=\"p-sinal-t\"><option value=\"nenhum\">Sem sinal</option><option value=\"fixo\">Valor fixo</option><option value=\"percentual\">Percentual</option></select></div><div class=\"field\"><label>Valor do sinal</label><input id=\"p-sinal-v\" type=\"number\" min=\"0\" step=\".01\"></div></div><div class=\"btns\"><button class=\"btn\" id=\"p-save\">Salvar formas</button><button class=\"btn secondary\" id=\"p-mp\">Conectar Mercado Pago</button></div><div class=\"status\" id=\"p-status\"></div>';",
" $('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);",
" const q=new URLSearchParams(location.search).get('mp');if(q==='conectado')$('p-status').textContent='Mercado Pago conectado com sucesso.';else if(q==='erro')$('p-status').textContent='A autorização do Mercado Pago não foi concluída.';",
" (async()=>{try{const st=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/status');const health=$('mp-health'),btn=$('p-mp');if(!st.plataforma?.configurado){health.textContent='A integração Mercado Pago do SaintsAI ainda precisa das credenciais da aplicação.';btn.disabled=true;btn.textContent='Mercado Pago aguardando ativação';}else if(st.conectado){health.textContent='Mercado Pago conectado'+(st.ambiente?' · '+st.ambiente:'');btn.textContent='Reconectar Mercado Pago';}else{health.textContent='Mercado Pago disponível para conexão.';btn.textContent='Conectar Mercado Pago';}}catch(e){$('mp-health').textContent='Não foi possível verificar o Mercado Pago agora.';}})();",
" $('p-save').onclick=async()=>{const st=$('p-status');try{st.textContent='Salvando…';const np=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:p.provedor||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});resumo.pagamentos={...p,...np};st.textContent='Formas de pagamento salvas.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};",
" $('p-mp').onclick=async()=>{const st=$('p-status'),b=$('p-mp');try{b.disabled=true;st.textContent='Abrindo autorização segura do Mercado Pago…';const x=await apiFetch('/pagamentos/mercadopago/lojas/'+loja.id+'/iniciar',{method:'POST',body:'{}'});if(!x.url)throw new Error('Não foi possível abrir a autorização.');location.href=x.url;}catch(e){st.textContent=e.message||'Não foi possível iniciar a conexão.';b.disabled=false;}};",
"}"
].join('\n');
cfgHtml=cfgHtml.slice(0,p0)+render+cfgHtml.slice(p1);
write('public/cliente-configuracao.html',cfgHtml);

/* 5) Validação final própria da migração. */
for(const p of ['src/services/mercadoPagoOAuth.service.js','src/controllers/mercadoPagoOAuth.controller.js','src/routes/mercadoPagoOAuth.routes.js','src/services/mercadoPagoPix.service.js','src/controllers/mercadoPagoWebhook.controller.js','src/routes/mercadoPagoWebhook.routes.js','src/services/bookingPublic.service.js','src/services/agendaWhatsapp.service.js','src/controllers/clienteHub.controller.js','src/app.js']){
  cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}
for(const file of ['public/cliente-configuracao.html','public/agendar.html']){
  const html=read(file),re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
  while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-mp-v2-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
  if(!n)throw new Error('Mercado Pago v2: HTML sem JavaScript '+file);
}
const finalBooking=read('src/services/bookingPublic.service.js');
const finalAgenda=read('src/services/agendaWhatsapp.service.js');
const finalConfig=read('public/cliente-configuracao.html');
if(!finalBooking.includes("c.provedor==='mercadopago'")||!finalBooking.includes('mercadoPagoPix.criarPixParaAgendamento'))throw new Error('Mercado Pago v2: booking não migrado');
if(!finalAgenda.includes("provedor==='mercadopago'")||!finalAgenda.includes('mercadoPagoPix.criarPixParaAgendamento'))throw new Error('Mercado Pago v2: WhatsApp não migrado');
if(!finalConfig.includes('Mercado Pago e formas de pagamento')||finalConfig.includes('PagBank e formas de pagamento'))throw new Error('Mercado Pago v2: UI não migrada');
if(!read('src/app.js').includes("mercadoPagoWebhookRoutes"))throw new Error('Mercado Pago v2: webhook não montado');
console.log('Mercado Pago v2: OAuth multiempresa, Pix, webhook, agenda e UI validados.');
