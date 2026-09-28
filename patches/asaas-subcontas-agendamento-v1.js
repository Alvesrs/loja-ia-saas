const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
function writeLines(p,a){write(p,a.join('\n'))}

writeLines('src/services/asaasSubconta.service.js',[
"const crypto=require('node:crypto');",
"const supabase=require('../config/supabase');",
"",
"function cfg(){",
"  const ambiente=String(process.env.ASAAS_ENVIRONMENT||'production').toLowerCase();",
"  const sandbox=ambiente==='sandbox';",
"  const rootKey=String(process.env.ASAAS_API_KEY||'').trim();",
"  let publicBase=String(process.env.SAINTSAI_PUBLIC_BASE_URL||'').trim().replace(/\\/+$/,'');",
"  if(!publicBase&&process.env.RAILWAY_PUBLIC_DOMAIN)publicBase='https://'+String(process.env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\\/\\//,'').replace(/\\/+$/,'');",
"  return {ambiente:sandbox?'sandbox':'production',base:sandbox?'https://api-sandbox.asaas.com':'https://api.asaas.com',rootKey,publicBase};",
"}",
"function configurado(){return Boolean(cfg().rootKey);}",
"function tokenWebhook(lojaId){const c=cfg();if(!c.rootKey)throw new Error('asaas_nao_configurado');return crypto.createHmac('sha256',c.rootKey).update('saintsai-subconta:'+String(lojaId)).digest('hex');}",
"async function req(path,opt={},key=null){",
"  const c=cfg(),apiKey=String(key||c.rootKey||'');if(!apiKey)throw new Error('asaas_nao_configurado');",
"  const r=await fetch(c.base+path,{method:opt.method||'GET',headers:{access_token:apiKey,accept:'application/json','content-type':'application/json','User-Agent':'SaintsAI/1.0'},body:opt.body?JSON.stringify(opt.body):undefined});",
"  const txt=await r.text();let body={};try{body=txt?JSON.parse(txt):{};}catch(_){body={raw:txt}}",
"  if(!r.ok){const e=new Error('asaas_http_'+r.status);e.status=r.status;e.body=body;throw e;}return body;",
"}",
"function limpar(v){return String(v||'').trim();}",
"function digitos(v){return limpar(v).replace(/\\D/g,'');}",
"async function obterConfig(lojaId){const {data,error}=await supabase.from('saintsai_pagamento_config').select('*').eq('loja_id',lojaId).maybeSingle();if(error)throw error;return data||null;}",
"async function obterApiKeyLoja(lojaId){",
"  const pc=await obterConfig(lojaId);if(!pc||pc.provedor!=='asaas'||pc.conectado!==true||!pc.provedor_secret_id)throw new Error('asaas_subconta_nao_conectada');",
"  const {data,error}=await supabase.rpc('saintsai_get_payment_secret',{p_secret_id:pc.provedor_secret_id});if(error)throw error;",
"  let sec={};try{sec=JSON.parse(String(data||'{}'));}catch(_){}if(!sec.apiKey)throw new Error('asaas_subconta_chave_ausente');return String(sec.apiKey);",
"}",
"async function status(lojaId){",
"  const c=cfg(),pc=await obterConfig(lojaId);",
"  return {plataforma:{configurado:Boolean(c.rootKey),ambiente:c.ambiente},conectado:Boolean(pc&&pc.provedor==='asaas'&&pc.conectado===true),status:pc&&pc.provedor==='asaas'?pc.provedor_status:null,conta_id:pc&&pc.provedor==='asaas'?pc.provedor_usuario_id:null,wallet_id:pc&&pc.provedor==='asaas'?pc.provedor_public_key:null,pix_online:Boolean(pc&&pc.provedor==='asaas'&&pc.aceita_pix_online)};",
"}",
"async function criarSubconta(lojaId,d){",
"  const c=cfg();if(!c.rootKey)throw new Error('asaas_nao_configurado');",
"  const atual=await obterConfig(lojaId);if(atual&&atual.provedor==='asaas'&&atual.conectado===true)return status(lojaId);",
"  const name=limpar(d.name),email=limpar(d.email).toLowerCase(),cpfCnpj=digitos(d.cpfCnpj),mobilePhone=digitos(d.mobilePhone),address=limpar(d.address),addressNumber=limpar(d.addressNumber),province=limpar(d.province),postalCode=digitos(d.postalCode),incomeValue=Number(d.incomeValue||0);",
"  const companyType=limpar(d.companyType||'MEI'),taxRegime=limpar(d.taxRegime||(companyType==='MEI'?'MEI':'UNKNOWN'));",
"  if(!name||!email||cpfCnpj.length!==14||mobilePhone.length<10||!address||!addressNumber||!province||postalCode.length!==8||!Number.isFinite(incomeValue)||incomeValue<=0)throw new Error('dados_subconta_invalidos');",
"  if(!['MEI','LIMITED','INDIVIDUAL','ASSOCIATION'].includes(companyType))throw new Error('tipo_empresa_invalido');",
"  if(!['MEI','NATIONAL_SIMPLE','NORMAL_REGIME','UNKNOWN'].includes(taxRegime))throw new Error('regime_invalido');",
"  if(!c.publicBase)throw new Error('url_publica_ausente');",
"  const webhookToken=tokenWebhook(lojaId);",
"  const payload={name,email,loginEmail:email,cpfCnpj,companyType,taxRegime,mobilePhone,incomeValue,address,addressNumber,province,postalCode,complement:limpar(d.complement),site:limpar(d.site)||c.publicBase,webhooks:[{name:'SaintsAI pagamentos',url:c.publicBase+'/api/pagamentos/asaas/subconta/webhook',email,sendType:'SEQUENTIALLY',interrupted:false,enabled:true,apiVersion:3,authToken:webhookToken,events:['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_REFUNDED','PAYMENT_DELETED']}]};",
"  const body=await req('/v3/accounts',{method:'POST',body:payload});if(!body.id||!body.apiKey)throw new Error('asaas_subconta_resposta_invalida');",
"  const segredo={apiKey:String(body.apiKey),accountId:String(body.id),walletId:body.walletId?String(body.walletId):null,criado_em:new Date().toISOString()};",
"  const {data:secretId,error:ev}=await supabase.rpc('saintsai_store_payment_secret',{p_loja_id:lojaId,p_secret:JSON.stringify(segredo)});if(ev)throw ev;",
"  const up={loja_id:lojaId,provedor:'asaas',conectado:true,provedor_secret_id:secretId,provedor_ambiente:c.ambiente,provedor_status:'SUBCONTA_CRIADA',provedor_conta_resumo:'Asaas ativado · conclua a validação pelo e-mail',provedor_usuario_id:String(body.id),provedor_public_key:body.walletId?String(body.walletId):null,aceita_pix_online:true,atualizado_em:new Date().toISOString()};",
"  const {error}=await supabase.from('saintsai_pagamento_config').upsert(up,{onConflict:'loja_id'});if(error){await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:secretId}).catch(()=>{});throw error;}",
"  if(atual&&atual.provedor_secret_id&&String(atual.provedor_secret_id)!==String(secretId))await supabase.rpc('saintsai_delete_payment_secret',{p_secret_id:atual.provedor_secret_id}).catch(()=>{});",
"  return {ok:true,conectado:true,status:'SUBCONTA_CRIADA',conta_id:String(body.id),wallet_id:body.walletId?String(body.walletId):null,mensagem:'Subconta Asaas criada. O titular deve concluir a ativação e validação recebidas por e-mail.'};",
"}",
"module.exports={cfg,configurado,req,status,criarSubconta,obterApiKeyLoja,tokenWebhook};"
]);

writeLines('src/controllers/asaasSubconta.controller.js',[
"const supabase=require('../config/supabase');",
"const supabaseAuth=require('../config/supabaseAuth');",
"const {usuarioEhAdmin}=require('../middleware/admin');",
"const svc=require('../services/asaasSubconta.service');",
"async function acesso(lojaId,u){const {data,error}=await supabase.from('lojas').select('id,dono_id,nome').eq('id',lojaId).maybeSingle();if(error)throw error;if(!data)return null;if(data.dono_id===u.id)return data;if(usuarioEhAdmin(u)){try{const {data:x}=await supabaseAuth.auth.admin.getUserById(data.dono_id);if(x?.user?.app_metadata?.saintsai_managed===true)return data;}catch(_){}}return null;}",
"async function status(req,res){try{const loja=await acesso(String(req.params.lojaId||''),req.usuario);if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});return res.json(await svc.status(loja.id));}catch(e){console.error('[asaas-subconta] status',e?.message||e);return res.status(500).json({erro:'Não foi possível consultar o Asaas.'});}}",
"async function criar(req,res){try{const loja=await acesso(String(req.params.lojaId||''),req.usuario);if(!loja)return res.status(403).json({erro:'Você não tem acesso a essa loja.'});const body={...req.body,name:String(req.body?.name||loja.nome||'').trim()};return res.status(201).json(await svc.criarSubconta(loja.id,body));}catch(e){if(e.message==='asaas_nao_configurado')return res.status(503).json({erro:'A integração Asaas do SaintsAI ainda não está configurada.'});if(['dados_subconta_invalidos','tipo_empresa_invalido','regime_invalido'].includes(e.message))return res.status(400).json({erro:'Confira CNPJ, telefone, faturamento e endereço antes de continuar.'});console.error('[asaas-subconta] criar',e?.status||'',e?.body||e?.message||e);const detalhe=Array.isArray(e?.body?.errors)?String(e.body.errors[0]?.description||'').trim():'';return res.status(e.status&&e.status<500?e.status:502).json({erro:detalhe||'O Asaas não aceitou a criação da conta agora. Confira os dados e tente novamente.'});}}",
"module.exports={status,criar};"
]);

writeLines('src/routes/asaasSubconta.routes.js',[
"const express=require('express');",
"const {exigirLogin}=require('../middleware/auth');",
"const c=require('../controllers/asaasSubconta.controller');",
"const r=express.Router();",
"r.get('/lojas/:lojaId/status',exigirLogin,c.status);",
"r.post('/lojas/:lojaId/criar',exigirLogin,c.criar);",
"module.exports=r;"
]);

writeLines('src/services/asaasAgendamentoPix.service.js',[
"const supabase=require('../config/supabase');",
"const sub=require('./asaasSubconta.service');",
"const envio=require('./whatsappEnvio.service');",
"function ext(lojaId,agId){return 'saintsai_ag:'+String(lojaId)+':'+String(agId)}",
"async function chavePix(apiKey){",
"  let lista=await sub.req('/v3/pix/addressKeys?status=ACTIVE&limit=20',{method:'GET'},apiKey);let itens=Array.isArray(lista?.data)?lista.data:[];let k=itens.find(x=>String(x?.status||'').toUpperCase()==='ACTIVE'&&x?.key);if(k?.key)return String(k.key);",
"  try{await sub.req('/v3/pix/addressKeys',{method:'POST',body:{type:'EVP'}},apiKey);}catch(_){}",
"  lista=await sub.req('/v3/pix/addressKeys?status=ACTIVE&limit=20',{method:'GET'},apiKey);itens=Array.isArray(lista?.data)?lista.data:[];k=itens.find(x=>String(x?.status||'').toUpperCase()==='ACTIVE'&&x?.key);if(k?.key)return String(k.key);throw new Error('asaas_pix_nao_ativo');",
"}",
"async function criarPixParaAgendamento(ag,servico){",
"  const apiKey=await sub.obterApiKeyLoja(ag.loja_id),key=await chavePix(apiKey),min=Math.max(5,Math.min(120,Number(process.env.ASAAS_PIX_EXPIRATION_MINUTES||15)));",
"  const body=await sub.req('/v3/pix/qrCodes/static',{method:'POST',body:{addressKey:key,description:('SaintsAI - '+String(servico.nome||'Agendamento')).slice(0,140),value:Number(Number(ag.valor||0).toFixed(2)),format:'ALL',expirationSeconds:min*60,allowsMultiplePayments:false,externalReference:ext(ag.loja_id,ag.id)}},apiKey);",
"  if(!body?.id||!body?.payload)throw new Error('asaas_pix_resposta_invalida');const exp=body.expirationDate||new Date(Date.now()+min*60000).toISOString();const qrUrl=body.encodedImage?('data:image/png;base64,'+String(body.encodedImage)):null;",
"  const {error}=await supabase.from('saintsai_agendamentos').update({pagamento_referencia:String(body.id),pagamento_charge_id:String(body.id),pagamento_qr_text:String(body.payload),pagamento_qr_url:qrUrl,pagamento_expira_em:exp,pagamento_provider_status:'PIX_AGUARDANDO',pagamento_status:'aguardando',status:'pendente',atualizado_em:new Date().toISOString()}).eq('id',ag.id).eq('loja_id',ag.loja_id);if(error)throw error;",
"  return {qrText:String(body.payload),qrUrl,expiraEm:exp};",
"}",
"function ids(payload){const p=payload?.payment||{};const ref=String(p.externalReference||'');const m=/^saintsai_ag:([^:]+):([^:]+)$/.exec(ref);return {eventId:String(payload?.id||''),event:String(payload?.event||''),pixId:p.pixQrCodeId?String(p.pixQrCodeId):null,lojaId:m?m[1]:null,agId:m?m[2]:null};}",
"async function localizar(payload){const i=ids(payload);if(i.agId&&i.lojaId){const {data,error}=await supabase.from('saintsai_agendamentos').select('*').eq('id',i.agId).eq('loja_id',i.lojaId).maybeSingle();if(error)throw error;if(data)return data;}if(i.pixId){const {data,error}=await supabase.from('saintsai_agendamentos').select('*').eq('pagamento_referencia',i.pixId).eq('pagamento_metodo','pix_online').maybeSingle();if(error)throw error;return data||null;}return null;}",
"function formatar(inicio){const d=new Date(inicio),a=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d),h=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);return {data:a,hora:h}}",
"async function confirmarWhatsapp(ag){if(!ag?.cliente_whatsapp)return;const agora=new Date().toISOString();const {data:claim,error}=await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:agora}).eq('id',ag.id).eq('loja_id',ag.loja_id).is('pagamento_confirmacao_enviada_em',null).select('id,loja_id,servico_id,cliente_whatsapp,inicio').maybeSingle();if(error||!claim)return;try{const [{data:cfgs},{data:s}]=await Promise.all([supabase.from('whatsapp_configuracoes').select('id,provedor,identificador_externo,ativo').eq('loja_id',claim.loja_id).eq('ativo',true).limit(10),supabase.from('saintsai_servicos').select('nome').eq('id',claim.servico_id).eq('loja_id',claim.loja_id).maybeSingle()]);const cfg=(cfgs||[]).find(x=>x.provedor==='waha')||(cfgs||[])[0];if(!cfg)throw new Error('sem_whatsapp');const f=formatar(claim.inicio),texto='Pagamento confirmado ✅ Seu agendamento de '+String(s?.nome||'atendimento')+' está confirmado para '+f.data+' às '+f.hora+'.';await envio.enviarRespostaWhatsapp(Object.freeze({canal:'whatsapp',lojaId:claim.loja_id,configuracaoId:cfg.id,contato:claim.cliente_whatsapp,texto:'',idExterno:'agenda-asaas-'+claim.id,timestamp:new Date().toISOString()}),Object.freeze({lojaId:claim.loja_id,contato:claim.cliente_whatsapp,idExterno:'agenda-asaas-'+claim.id,resposta:texto}),Object.freeze({provedor:cfg.provedor,destinatarioId:cfg.identificador_externo}));}catch(e){await supabase.from('saintsai_agendamentos').update({pagamento_confirmacao_enviada_em:null}).eq('id',claim.id).eq('loja_id',claim.loja_id);throw e;}}",
"async function processar(payload){const i=ids(payload),ag=await localizar(payload);if(!ag)return {ignorado:true};const now=new Date().toISOString(),u={pagamento_provider_status:i.event||'ASAAS',atualizado_em:now};if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(i.event)){u.pagamento_status='pago';u.pagamento_pago_em=now;if(!['cancelado','nao_compareceu'].includes(String(ag.status||'')))u.status='confirmado';}else if(['PAYMENT_REFUNDED'].includes(i.event)){u.pagamento_status='estornado';u.status='cancelado';}else if(['PAYMENT_OVERDUE','PAYMENT_DELETED'].includes(i.event)){u.pagamento_status='cancelado';u.status='cancelado';}else return {ignorado:true};const {data,error}=await supabase.from('saintsai_agendamentos').update(u).eq('id',ag.id).eq('loja_id',ag.loja_id).select('*').maybeSingle();if(error)throw error;if(u.pagamento_status==='pago'&&data?.status==='confirmado')try{await confirmarWhatsapp(data);}catch(e){console.error('[asaas-agenda-confirmacao]',e?.message||e)}return {ok:true};}",
"async function expirarReservas(){const {data,error}=await supabase.from('saintsai_agendamentos').select('id,loja_id').eq('pagamento_metodo','pix_online').eq('pagamento_status','aguardando').eq('status','pendente').not('pagamento_expira_em','is',null).lte('pagamento_expira_em',new Date().toISOString()).limit(100);if(error)throw error;let n=0;for(const ag of data||[]){const {error:e}=await supabase.from('saintsai_agendamentos').update({status:'cancelado',pagamento_status:'cancelado',pagamento_provider_status:'EXPIRED_LOCAL',atualizado_em:new Date().toISOString()}).eq('id',ag.id).eq('loja_id',ag.loja_id).eq('pagamento_status','aguardando');if(!e)n++;}return n;}",
"module.exports={criarPixParaAgendamento,processar,localizar,ids,expirarReservas};"
]);

writeLines('src/controllers/asaasSubcontaWebhook.controller.js',[
"const crypto=require('node:crypto');",
"const pix=require('../services/asaasAgendamentoPix.service');",
"const sub=require('../services/asaasSubconta.service');",
"function seguro(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}",
"async function webhook(req,res){try{const ag=await pix.localizar(req.body||{});if(!ag)return res.status(200).json({ok:true,ignorado:true});const recebido=String(req.get('asaas-access-token')||'');if(!seguro(recebido,sub.tokenWebhook(ag.loja_id)))return res.status(401).json({erro:'Webhook não autorizado.'});res.status(200).json({ok:true});try{await pix.processar(req.body||{});}catch(e){console.error('[asaas-subconta-webhook]',e?.message||e);}}catch(e){console.error('[asaas-subconta-webhook]',e?.message||e);return res.status(500).json({erro:'Falha no webhook.'});}}",
"module.exports={webhook};"
]);

writeLines('src/routes/asaasSubcontaWebhook.routes.js',[
"const express=require('express');",
"const c=require('../controllers/asaasSubcontaWebhook.controller');",
"const r=express.Router();",
"r.post('/webhook',c.webhook);",
"module.exports=r;"
]);

let app=read('src/app.js');
if(!app.includes("asaasSubcontaRoutes")){
  const anchor="const pagBankConnectRoutes = require('./routes/pagBankConnect.routes');";
  if(!app.includes(anchor))throw new Error('Anchor pagamentos não encontrado');
  app=app.replace(anchor,anchor+"\nconst asaasSubcontaRoutes = require('./routes/asaasSubconta.routes');\nconst asaasSubcontaWebhookRoutes = require('./routes/asaasSubcontaWebhook.routes');");
  const use="app.use('/api/pagamentos/pagbank', pagBankConnectRoutes);";
  if(!app.includes(use))throw new Error('Mount pagamentos não encontrado');
  app=app.replace(use,use+"\napp.use('/api/pagamentos/asaas', asaasSubcontaRoutes);\napp.use('/api/pagamentos/asaas/subconta', asaasSubcontaWebhookRoutes);");
}
write('src/app.js',app);

let booking=read('src/services/bookingPublic.service.js');
booking=booking.replace("const pagBankPix=require('./pagBankPix.service');","const asaasPix=require('./asaasAgendamentoPix.service');");
booking=booking.replace("c.provedor==='pagbank'","c.provedor==='asaas'");
booking=booking.replace("const online=false; // MP_PIX_V2_PENDING","const online=Boolean(c.conectado&&c.provedor==='asaas'&&c.aceita_pix_online);");
booking=booking.replace(/pagBankPix\.criarPixParaAgendamento/g,"asaasPix.criarPixParaAgendamento");
write('src/services/bookingPublic.service.js',booking);

let agenda=read('src/services/agendaWhatsapp.service.js');
agenda=agenda.replace("const pagBankPix=require('./pagBankPix.service');","const asaasPix=require('./asaasAgendamentoPix.service');");
agenda=agenda.replace(/pagCfg\?\.provedor==='pagbank'/g,"pagCfg?.provedor==='asaas'");
agenda=agenda.replace(/pag\?\.provedor==='pagbank'/g,"pag?.provedor==='asaas'");
agenda=agenda.replace(/pagBankPix\.criarPixParaAgendamento/g,"asaasPix.criarPixParaAgendamento");
write('src/services/agendaWhatsapp.service.js',agenda);

let worker=read('src/services/whatsappWorker.service.js');
worker=worker.replace("const pagBankPix = require('./pagBankPix.service');","const asaasPix = require('./asaasAgendamentoPix.service');");
worker=worker.replace(/pagBankPix\.expirarReservas\(\)/g,"asaasPix.expirarReservas()");
write('src/services/whatsappWorker.service.js',worker);

let hub=read('src/controllers/clienteHub.controller.js');
hub=hub.replace(/id:'pagbank'/g,"id:'asaas'").replace(/id:'mercadopago'/g,"id:'asaas'");
hub=hub.replace(/titulo:'Conecte o PagBank'/g,"titulo:'Ative pagamentos Asaas'").replace(/titulo:'Conecte o Mercado Pago'/g,"titulo:'Ative pagamentos Asaas'");
hub=hub.replace(/descricao:'Conecte sua conta PagBank para receber pagamentos online\.'/g,"descricao:'Crie sua conta de recebimento Asaas para receber Pix online.'").replace(/descricao:'Conecte sua conta Mercado Pago para receber pagamentos online\.'/g,"descricao:'Crie sua conta de recebimento Asaas para receber Pix online.'");
write('src/controllers/clienteHub.controller.js',hub);

let h=read('public/cliente-configuracao.html');
const p0=h.indexOf('function renderPagamentos(){');
const p1=h.indexOf('\nfunction renderAgenda(){',p0);
if(p0<0||p1<0)throw new Error('renderPagamentos não encontrado');
const render=[
"function renderPagamentos(){",
" const p=resumo.pagamentos||{};",
" $('content').innerHTML='<h2>Asaas e formas de pagamento</h2><p class=\"muted\">Ative uma conta Asaas vinculada à sua empresa. O dinheiro dos seus clientes fica separado e é recebido na conta da própria empresa.</p><div class=\"notice\" id=\"asaas-health\">Verificando Asaas…</div><div id=\"asaas-form\"><div class=\"row\"><div class=\"field\"><label>Nome / Razão social</label><input id=\"a-name\" value=\"'+String(loja.nome||'').replace(/\"/g,'&quot;')+'\"></div><div class=\"field\"><label>E-mail do titular</label><input id=\"a-email\" type=\"email\"></div></div><div class=\"row\"><div class=\"field\"><label>CNPJ</label><input id=\"a-cnpj\" inputmode=\"numeric\"></div><div class=\"field\"><label>Tipo da empresa</label><select id=\"a-type\"><option value=\"MEI\">MEI</option><option value=\"LIMITED\">LTDA</option><option value=\"INDIVIDUAL\">Empresário individual</option><option value=\"ASSOCIATION\">Associação</option></select></div></div><div class=\"row\"><div class=\"field\"><label>Celular</label><input id=\"a-phone\" inputmode=\"tel\"></div><div class=\"field\"><label>Faturamento mensal</label><input id=\"a-income\" type=\"number\" min=\"1\" step=\"0.01\"></div></div><div class=\"row\"><div class=\"field\"><label>CEP</label><input id=\"a-cep\" inputmode=\"numeric\"></div><div class=\"field\"><label>Logradouro</label><input id=\"a-address\"></div></div><div class=\"row\"><div class=\"field\"><label>Número</label><input id=\"a-number\"></div><div class=\"field\"><label>Bairro</label><input id=\"a-province\"></div></div><div class=\"field\"><label>Complemento (opcional)</label><input id=\"a-complement\"></div><div class=\"btns\"><button class=\"btn secondary\" id=\"a-create\">Ativar pagamentos Asaas</button></div></div><hr style=\"border:0;border-top:1px solid rgba(255,255,255,.08);margin:20px 0\"><div class=\"checks\"><label class=\"check\"><input id=\"p-din\" type=\"checkbox\"> Dinheiro</label><label class=\"check\"><input id=\"p-pixp\" type=\"checkbox\"> Pix presencial</label><label class=\"check\"><input id=\"p-cart\" type=\"checkbox\"> Cartão presencial</label><label class=\"check\"><input id=\"p-pixo\" type=\"checkbox\"> Pix online / automático</label><label class=\"check\"><input id=\"p-antec\" type=\"checkbox\"> Exigir pagamento antecipado</label></div><div class=\"row\"><div class=\"field\"><label>Sinal</label><select id=\"p-sinal-t\"><option value=\"nenhum\">Sem sinal</option><option value=\"fixo\">Valor fixo</option><option value=\"percentual\">Percentual</option></select></div><div class=\"field\"><label>Valor do sinal</label><input id=\"p-sinal-v\" type=\"number\" min=\"0\" step=\".01\"></div></div><div class=\"btns\"><button class=\"btn\" id=\"p-save\">Salvar formas</button></div><div class=\"status\" id=\"p-status\"></div>';",
" $('p-din').checked=!!p.aceita_dinheiro;$('p-pixp').checked=!!p.aceita_pix_presencial;$('p-cart').checked=!!p.aceita_cartao_presencial;$('p-pixo').checked=!!p.aceita_pix_online;$('p-antec').checked=!!p.exige_pagamento_antecipado;$('p-sinal-t').value=p.sinal_tipo||'nenhum';$('p-sinal-v').value=Number(p.sinal_valor||0);",
" (async()=>{try{const st=await apiFetch('/pagamentos/asaas/lojas/'+loja.id+'/status');const health=$('asaas-health');if(!st.plataforma?.configurado){health.textContent='A integração Asaas do SaintsAI ainda não está configurada.';$('a-create').disabled=true;}else if(st.conectado){health.textContent='Asaas ativado'+(st.status?' · '+st.status:'')+'. Confira o e-mail do titular para concluir a validação da conta.';$('asaas-form').style.display='none';}else{health.textContent='Asaas disponível. Preencha os dados reais da empresa para ativar.';}}catch(e){$('asaas-health').textContent='Não foi possível verificar o Asaas agora.';}})();",
" $('a-create').onclick=async()=>{const st=$('p-status'),b=$('a-create');try{b.disabled=true;st.textContent='Criando conta Asaas…';const body={name:$('a-name').value,email:$('a-email').value,cpfCnpj:$('a-cnpj').value,companyType:$('a-type').value,taxRegime:$('a-type').value==='MEI'?'MEI':'UNKNOWN',mobilePhone:$('a-phone').value,incomeValue:Number($('a-income').value||0),postalCode:$('a-cep').value,address:$('a-address').value,addressNumber:$('a-number').value,province:$('a-province').value,complement:$('a-complement').value};const x=await apiFetch('/pagamentos/asaas/lojas/'+loja.id+'/criar',{method:'POST',body:JSON.stringify(body)});st.textContent=x.mensagem||'Asaas ativado. Confira o e-mail para concluir a validação.';$('asaas-health').textContent='Asaas ativado · aguardando validação do titular';$('asaas-form').style.display='none';resumo.pagamentos={...p,provedor:'asaas',conectado:true,aceita_pix_online:true};await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível ativar o Asaas.';b.disabled=false;}};",
" $('p-save').onclick=async()=>{const st=$('p-status');try{st.textContent='Salvando…';const np=await apiFetch('/lojas/'+loja.id+'/cliente-hub/pagamentos',{method:'PUT',body:JSON.stringify({provedor:resumo.pagamentos?.provedor||p.provedor||null,aceita_dinheiro:$('p-din').checked,aceita_pix_presencial:$('p-pixp').checked,aceita_cartao_presencial:$('p-cart').checked,aceita_pix_online:$('p-pixo').checked,exige_pagamento_antecipado:$('p-antec').checked,sinal_tipo:$('p-sinal-t').value,sinal_valor:Number($('p-sinal-v').value||0)})});resumo.pagamentos={...p,...np};st.textContent='Formas de pagamento salvas.';await recarregarProgresso();}catch(e){st.textContent=e.message||'Não foi possível salvar.';}};",
"}"
].join('\n');
h=h.slice(0,p0)+render+h.slice(p1);
write('public/cliente-configuracao.html',h);

for(const p of ['src/services/asaasSubconta.service.js','src/controllers/asaasSubconta.controller.js','src/routes/asaasSubconta.routes.js','src/services/asaasAgendamentoPix.service.js','src/controllers/asaasSubcontaWebhook.controller.js','src/routes/asaasSubcontaWebhook.routes.js','src/services/bookingPublic.service.js','src/services/agendaWhatsapp.service.js','src/services/whatsappWorker.service.js','src/controllers/clienteHub.controller.js']){
  cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}
for(const file of ['public/cliente-configuracao.html']){
  const html=read(file),re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m,n=0;
  while((m=re.exec(html))){const code=m[1].trim();if(!code)continue;const tmp=path.join(os.tmpdir(),'saintsai-asaas-'+(++n)+'.js');fs.writeFileSync(tmp,code);try{cp.execFileSync(process.execPath,['--check',tmp],{stdio:'inherit'});}finally{try{fs.unlinkSync(tmp)}catch(_){}}}
}
console.log('Asaas subcontas + Pix de agendamento aplicado ao SaintsAI Cliente.');