const fs = require('node:fs');

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,v){ fs.mkdirSync(require('node:path').dirname(p),{recursive:true}); fs.writeFileSync(p,v); }
function replaceOnce(p, from, to){
  const src=read(p);
  if(!src.includes(from)) throw new Error('Trecho esperado não encontrado em '+p);
  write(p, src.replace(from,to));
}

write('src/services/providers/whatsapp/adaptadorWaha.js', `
const { criarPedidoDeEnvio, criarResultadoEnvio, criarResultadoFalha, STATUS_ENVIO, CODIGOS_ERRO_ENVIO } = require('./contrato');
const { ehStringNaoVazia } = require('../../../utils/validacao');

const NOME_DO_ADAPTADOR = 'waha';
const TIMEOUT_PADRAO_MS = 15000;

function configAmbiente() {
  const timeout = Number(process.env.WAHA_TIMEOUT_MS);
  return {
    baseUrl: ehStringNaoVazia(process.env.WAHA_BASE_URL) ? process.env.WAHA_BASE_URL.replace(/\\/+$/, '') : null,
    apiKey: process.env.WAHA_API_KEY,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : TIMEOUT_PADRAO_MS,
  };
}

function chatIdDoContato(contato) {
  const valor = String(contato || '').trim();
  if (valor.includes('@')) return valor;
  const digitos = valor.replace(/\\D/g, '');
  return digitos ? digitos + '@c.us' : '';
}

function extrairId(dados) {
  const candidatos = [
    dados && dados.id,
    dados && dados.key && dados.key.id,
    dados && dados._data && dados._data.id && (dados._data.id.id || dados._data.id._serialized),
  ];
  return candidatos.find(ehStringNaoVazia) || null;
}

function criarAdaptadorWaha(opcoes = {}) {
  const env = configAmbiente();
  const baseUrl = ehStringNaoVazia(opcoes.baseUrl) ? opcoes.baseUrl.replace(/\\/+$/, '') : env.baseUrl;
  const apiKey = ehStringNaoVazia(opcoes.apiKey) ? opcoes.apiKey : env.apiKey;
  const session = ehStringNaoVazia(opcoes.session) ? opcoes.session.trim() : null;
  const timeoutMs = Number.isFinite(opcoes.timeoutMs) && opcoes.timeoutMs > 0 ? opcoes.timeoutMs : env.timeoutMs;
  const fetchFn = typeof opcoes.fetchFn === 'function' ? opcoes.fetchFn : global.fetch;

  return Object.freeze({
    nome: NOME_DO_ADAPTADOR,
    async enviarMensagem(entrada) {
      const pedido = criarPedidoDeEnvio(entrada);
      if (!ehStringNaoVazia(baseUrl) || !ehStringNaoVazia(apiKey) || !ehStringNaoVazia(session) || typeof fetchFn !== 'function') {
        return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.erroInterno });
      }
      const chatId = chatIdDoContato(pedido.contato);
      if (!chatId) return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.mensagemRejeitada });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetchFn(baseUrl + '/api/sendText', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
          body: JSON.stringify({ session, chatId, text: pedido.texto }),
          signal: controller.signal,
        });
        let dados = null;
        try { dados = await resp.json(); } catch (_) {}
        if (!resp.ok) {
          const codigo = resp.status === 429 || resp.status >= 500
            ? CODIGOS_ERRO_ENVIO.provedorIndisponivel
            : CODIGOS_ERRO_ENVIO.mensagemRejeitada;
          return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: codigo });
        }
        return criarResultadoEnvio({
          provedor: NOME_DO_ADAPTADOR,
          status: STATUS_ENVIO.enviado,
          idExterno: extrairId(dados),
        });
      } catch (_) {
        return criarResultadoFalha({ provedor: NOME_DO_ADAPTADOR, codigoErro: CODIGOS_ERRO_ENVIO.provedorIndisponivel });
      } finally {
        clearTimeout(timer);
      }
    },
    normalizarMensagemRecebida(entrada) { return entrada; },
    identificarContato(m) { return m && m.contato || null; },
    identificarLoja(m) { return m && m.lojaId || null; },
  });
}

module.exports = { criarAdaptadorWaha, NOME_DO_ADAPTADOR, chatIdDoContato, extrairId };
`);

write('src/services/providers/whatsapp/interpretadorWebhookWaha.js', `
const { ehStringNaoVazia } = require('../../../utils/validacao');

class ErroWebhookWahaInvalido extends Error {
  constructor(){ super('Evento WAHA inválido.'); this.name='ErroWebhookWahaInvalido'; }
}

function timestampIso(valor) {
  if (valor === undefined || valor === null) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 100000000000 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function interpretarPayloadWebhookWaha(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErroWebhookWahaInvalido();
  if (body.event !== 'message') return null;
  if (!ehStringNaoVazia(body.session)) throw new ErroWebhookWahaInvalido();

  const p = body.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ErroWebhookWahaInvalido();
  if (p.fromMe === true) return null;
  if (!ehStringNaoVazia(p.id) || !ehStringNaoVazia(p.from)) throw new ErroWebhookWahaInvalido();
  if (!p.from.endsWith('@c.us') && !p.from.endsWith('@lid')) return null;
  if (!ehStringNaoVazia(p.body)) return null;

  return Object.freeze({
    destinatarioId: body.session.trim(),
    contato: p.from.trim(),
    texto: p.body.trim(),
    idExterno: p.id.trim(),
    timestamp: timestampIso(p.timestamp),
  });
}

module.exports = { interpretarPayloadWebhookWaha, ErroWebhookWahaInvalido };
`);

write('src/middleware/wahaWebhookHmac.js', `
const crypto = require('node:crypto');

function verificarHmacWaha(req,res,next){
  const chave = process.env.WAHA_WEBHOOK_HMAC_KEY;
  if (typeof chave !== 'string' || !chave) return res.status(503).json({erro:'Webhook WAHA indisponível.'});
  const recebido = req.get('X-Webhook-Hmac');
  const algoritmo = String(req.get('X-Webhook-Hmac-Algorithm') || '').toLowerCase();
  if (!recebido || algoritmo !== 'sha512' || !Buffer.isBuffer(req.corpoBruto)) return res.status(401).json({erro:'Webhook não autorizado.'});
  const esperado = crypto.createHmac('sha512', chave).update(req.corpoBruto).digest('hex');
  const a=Buffer.from(String(recebido),'utf8'), b=Buffer.from(esperado,'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({erro:'Webhook não autorizado.'});
  next();
}
module.exports={verificarHmacWaha};
`);

write('src/controllers/whatsappWahaWebhook.controller.js', `
const parser = require('../services/providers/whatsapp/interpretadorWebhookWaha');
const webhookService = require('../services/whatsappWebhook.service');
const filaService = require('../services/whatsappFila.service');
const workerService = require('../services/whatsappWorker.service');
const idempotenciaService = require('../services/whatsappIdempotencia.service');

const CONTEXTO = Object.freeze({provedor:'waha'});
const pendentes = new Map();

function janelaAgrupamentoMs(){
  const valor = Number(process.env.WHATSAPP_AGRUPAMENTO_MS);
  if (!Number.isFinite(valor)) return 5000;
  return Math.max(1500, Math.min(valor, 15000));
}

function chaveConversa(evento){
  return evento.destinatarioId + '|' + evento.contato;
}

async function liberarReservas(itens){
  for (const item of itens) {
    try {
      await idempotenciaService.liberarEventoWhatsapp({provedor:'waha',idExterno:item.idExterno});
    } catch (_) {}
  }
}

async function processarLote(chave){
  const lote = pendentes.get(chave);
  if (!lote) return;
  pendentes.delete(chave);
  const itens = lote.eventos;
  if (!itens.length) return;

  const ultimo = itens[itens.length - 1];
  const combinado = Object.freeze({
    ...ultimo,
    texto: itens.map((item) => item.texto).filter(Boolean).join('\\n'),
  });

  try {
    console.log('[waha.webhook] agrupado', JSON.stringify({
      contato: combinado.contato,
      destinatarioId: combinado.destinatarioId,
      mensagens: itens.length,
      janelaMs: janelaAgrupamentoMs(),
    }));
    const interna = await webhookService.processarEventoWhatsapp(combinado, CONTEXTO);
    const job = await filaService.enfileirarMensagemWhatsapp(interna,{
      provedor:'waha',
      destinatarioId:combinado.destinatarioId
    });
    await workerService.processarJob(job);
    console.log('[waha.webhook] lote_processado', combinado.idExterno);
  } catch (erro) {
    console.error('[waha.webhook] erro_lote', erro && (erro.stack || erro.message || erro));
    await liberarReservas(itens);
  }
}

async function receber(req,res){
  let evento;
  try { evento = parser.interpretarPayloadWebhookWaha(req.body); }
  catch (_) { return res.status(400).json({erro:'Evento WAHA inválido.'}); }
  if (!evento) return res.status(200).json({status:'sem_mensagem_processavel'});

  const chaveId={provedor:'waha',idExterno:evento.idExterno};
  try{
    const reservou = await idempotenciaService.reservarEventoWhatsapp(chaveId);
    if(!reservou) return res.status(200).json({status:'duplicado_ignorado'});

    const chave = chaveConversa(evento);
    const anterior = pendentes.get(chave);
    if (anterior && anterior.timer) clearTimeout(anterior.timer);

    const eventos = anterior ? anterior.eventos : [];
    eventos.push(evento);

    const timer = setTimeout(() => {
      processarLote(chave).catch((erro) => {
        console.error('[waha.webhook] falha_assincrona', erro && (erro.stack || erro.message || erro));
      });
    }, janelaAgrupamentoMs());

    pendentes.set(chave,{eventos,timer});
    return res.status(200).json({
      status:'recebido_agrupando',
      mensagens_no_lote:eventos.length
    });
  }catch(erro){
    console.error('[waha.webhook] erro', erro && (erro.stack || erro.message || erro));
    try{await idempotenciaService.liberarEventoWhatsapp(chaveId);}catch(_){}
    if(!res.headersSent) return res.status(500).json({erro:'Erro interno ao processar o evento.'});
    return res;
  }
}
module.exports={receber};
`);

write('src/routes/whatsappWahaWebhook.routes.js', `
const express=require('express');
const controller=require('../controllers/whatsappWahaWebhook.controller');
const {verificarHmacWaha}=require('../middleware/wahaWebhookHmac');
const router=express.Router();
router.post('/', express.json({limit:'100kb',verify:(req,res,buf)=>{req.corpoBruto=buf;}}), verificarHmacWaha, controller.receber);
module.exports=router;
`);

write('src/services/wahaOnboarding.service.js', `
const configuracoes=require('./whatsappConfiguracao.service');
const {ehUuid,ehStringNaoVazia}=require('../utils/validacao');

class ErroWaha extends Error {
  constructor(mensagem,status=502){ super(mensagem); this.name='ErroWaha'; this.status=status; }
}
function env(){
  const base=process.env.WAHA_BASE_URL;
  const key=process.env.WAHA_API_KEY;
  const hmac=process.env.WAHA_WEBHOOK_HMAC_KEY;
  const publicBase=process.env.PUBLIC_BASE_URL;
  if(!ehStringNaoVazia(base)||!ehStringNaoVazia(key)||!ehStringNaoVazia(hmac)||!ehStringNaoVazia(publicBase)) throw new ErroWaha('Integração WAHA ainda não configurada.',503);
  return {base:base.replace(/\\/+$/,''),key,hmac,publicBase:publicBase.replace(/\\/+$/,'')};
}
function sessionName(lojaId){
  if(!ehUuid(lojaId)) throw new ErroWaha('Loja inválida.',400);
  return 'saintsai_'+lojaId.replace(/-/g,'');
}
function numero(valor){
  let d=String(valor||'').replace(/\\D/g,'');
  if(d.length===10||d.length===11) d='55'+d;
  if(d.length<12||d.length>15) throw new ErroWaha('Informe um número válido com DDI e DDD.',400);
  return d;
}
async function chamar(path,opcoes={}){
  const e=env();
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(e.base+path,{...opcoes,headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':e.key,...(opcoes.headers||{})},signal:ctrl.signal});
    let data=null; try{data=await r.json();}catch(_){}
    return {ok:r.ok,status:r.status,data};
  }catch(_){ throw new ErroWaha('WAHA temporariamente indisponível.',503); }
  finally{clearTimeout(t);}
}
async function obterOuCriarConfig(lojaId,fone,sessao){
  const itens=await configuracoes.listarConfiguracoesWhatsapp(lojaId);
  let cfg=itens.find(x=>x.provedor==='waha'&&x.ativo);
  if(cfg){
    if(cfg.identificador_externo!==sessao || cfg.numero_whatsapp!==fone){
      cfg=await configuracoes.atualizarConfiguracaoWhatsapp(cfg.id,lojaId,{numero_whatsapp:fone,identificador_externo:sessao,ativo:true});
    }
    return cfg;
  }
  return configuracoes.criarConfiguracaoWhatsapp({provedor:'waha',numero_whatsapp:fone,identificador_externo:sessao,ativo:true},lojaId);
}
async function iniciarPareamento(lojaId,phoneNumber){
  const fone=numero(phoneNumber), sessao=sessionName(lojaId), e=env();
  await obterOuCriarConfig(lojaId,fone,sessao);

  const existente=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'GET'});
  const statusExistente=String(existente.data&&existente.data.status||'');
  if(existente.ok && statusExistente==='FAILED'){
    const removido=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'DELETE'});
    if(!removido.ok && removido.status!==404) throw new ErroWaha('Não foi possível resetar a sessão do WhatsApp.',502);
    await new Promise(resolve=>setTimeout(resolve,300));
  }

  const criado=await chamar('/api/sessions',{method:'POST',body:JSON.stringify({
    name:sessao,
    config:{webhooks:[{url:e.publicBase+'/api/webhooks/waha',events:['message'],hmac:{key:e.hmac}}]}
  })});
  if(!criado.ok && criado.status!==409 && criado.status!==422) throw new ErroWaha('Não foi possível preparar a sessão do WhatsApp.',502);

  const iniciado=await chamar('/api/sessions/'+encodeURIComponent(sessao)+'/start',{method:'POST'});
  if(!iniciado.ok && iniciado.status!==409) throw new ErroWaha('Não foi possível iniciar a sessão do WhatsApp.',502);

  let codigo=null;
  for(let tentativa=0;tentativa<10;tentativa++){
    codigo=await chamar('/api/'+encodeURIComponent(sessao)+'/auth/request-code',{method:'POST',body:JSON.stringify({phoneNumber:fone})});
    if(codigo.ok && codigo.data && ehStringNaoVazia(codigo.data.code)) break;
    if(codigo.status!==404 && codigo.status!==409 && codigo.status!==422) break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!codigo || !codigo.ok || !codigo.data || !ehStringNaoVazia(codigo.data.code)) throw new ErroWaha('Não foi possível gerar o código de pareamento.',codigo&&codigo.status===422?422:502);
  return Object.freeze({session:sessao,code:codigo.data.code,status:'PAIRING'});
}
async function status(lojaId){
  const sessao=sessionName(lojaId);
  const r=await chamar('/api/sessions/'+encodeURIComponent(sessao),{method:'GET'});
  if(r.status===404) return Object.freeze({session:sessao,status:'NOT_FOUND',connected:false});
  if(!r.ok) throw new ErroWaha('Não foi possível consultar a conexão.',502);
  const st=String(r.data&&r.data.status||'UNKNOWN');
  return Object.freeze({session:sessao,status:st,connected:st==='WORKING'});
}
module.exports={iniciarPareamento,status,ErroWaha,sessionName};
`);

replaceOnce(
  'src/services/providers/whatsapp/index.js',
  "const { criarAdaptadorMeta, NOME_DO_ADAPTADOR: NOME_DO_ADAPTADOR_META } = require('./adaptadorMeta');",
  "const { criarAdaptadorMeta, NOME_DO_ADAPTADOR: NOME_DO_ADAPTADOR_META } = require('./adaptadorMeta');\nconst { criarAdaptadorWaha, NOME_DO_ADAPTADOR: NOME_DO_ADAPTADOR_WAHA } = require('./adaptadorWaha');"
);
replaceOnce(
  'src/services/providers/whatsapp/index.js',
  "  [NOME_DO_ADAPTADOR_META, criarAdaptadorMeta],",
  "  [NOME_DO_ADAPTADOR_META, criarAdaptadorMeta],\n  [NOME_DO_ADAPTADOR_WAHA, criarAdaptadorWaha],"
);

replaceOnce(
  'src/services/whatsappEnvio.service.js',
  "    const opcoesProvedor = { phoneNumberId: config.identificador_externo };",
  "    const opcoesProvedor = config.provedor === 'waha'\n      ? { session: config.identificador_externo }\n      : { phoneNumberId: config.identificador_externo };"
);
replaceOnce(
  'src/services/whatsappEnvio.service.js',
  "        (config.provedor === 'meta' && !provedores.mensagemFoiEnviada(resultado))) {",
  "        ((config.provedor === 'meta' || config.provedor === 'waha') && !provedores.mensagemFoiEnviada(resultado))) {"
);

replaceOnce(
  'src/app.js',
  "const whatsappWebhookRoutes = require('./routes/whatsappWebhook.routes');",
  "const whatsappWebhookRoutes = require('./routes/whatsappWebhook.routes');\nconst whatsappWahaWebhookRoutes = require('./routes/whatsappWahaWebhook.routes');"
);
replaceOnce(
  'src/app.js',
  "app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);",
  "app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);\napp.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);"
);

replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "const embeddedSignup = require('../services/metaEmbeddedSignup.service');",
  "const embeddedSignup = require('../services/metaEmbeddedSignup.service');\nconst wahaOnboarding = require('../services/wahaOnboarding.service');"
);
replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "  if (erro instanceof embeddedSignup.ErroEmbeddedSignup) return res.status(erro.status || 400).json({ erro: erro.message });",
  "  if (erro instanceof embeddedSignup.ErroEmbeddedSignup) return res.status(erro.status || 400).json({ erro: erro.message });\n  if (erro instanceof wahaOnboarding.ErroWaha) return res.status(erro.status || 400).json({ erro: erro.message });"
);
replaceOnce(
  'src/controllers/whatsappConfiguracao.controller.js',
  "module.exports = {\n  criar, listar, buscar, atualizar, desativar, salvarCredencial,",
  `async function iniciarWaha(req,res){
  try { return res.json(await wahaOnboarding.iniciarPareamento(req.params.lojaId, req.body && req.body.phone_number)); }
  catch(erro){ return responderErro(res,erro); }
}
async function statusWaha(req,res){
  try { return res.json(await wahaOnboarding.status(req.params.lojaId)); }
  catch(erro){ return responderErro(res,erro); }
}

module.exports = {
  iniciarWaha, statusWaha,
  criar, listar, buscar, atualizar, desativar, salvarCredencial,`
);

replaceOnce(
  'src/routes/whatsappConfiguracao.routes.js',
  "router.get('/embedded-signup/config', controller.configuracaoEmbeddedSignup);",
  "router.post('/waha/pair', controller.iniciarWaha);\nrouter.get('/waha/status', controller.statusWaha);\n\nrouter.get('/embedded-signup/config', controller.configuracaoEmbeddedSignup);"
);

replaceOnce(
  'public/whatsapp.html',
  '<section class="wa-card" aria-label="Conexão automática com a Meta" id="wa-embedded-card">',
  `<section class="wa-card" aria-label="Conexão rápida do WhatsApp" id="wa-waha-card">
        <div class="wa-card-head">
          <div>
            <span class="eyebrow">Modo rápido</span>
            <h2>Conectar pelo número</h2>
            <p>Digite o número com DDI e DDD. O SaintsAI gera um código para vincular o WhatsApp sem Facebook ou QR Code.</p>
          </div>
          <span id="wa-waha-status" class="badge badge-inativo">Não conectado</span>
        </div>
        <div class="field">
          <label for="wa-waha-numero">Número do WhatsApp</label>
          <input id="wa-waha-numero" type="tel" inputmode="tel" placeholder="5544999999999" autocomplete="tel">
        </div>
        <div class="wa-actions">
          <button id="wa-conectar-waha" type="button" class="btn-primary">Gerar código de conexão</button>
        </div>
        <div id="wa-waha-codigo" class="field-help" style="font-size:22px;font-weight:800;letter-spacing:2px;margin-top:12px"></div>
        <div class="field-help">No WhatsApp: Configurações → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone.</div>
      </section>

      <details class="wa-card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:700">Conexão oficial pela Meta</summary>
        <div style="margin-top:16px">
      <section class="wa-card" aria-label="Conexão automática com a Meta" id="wa-embedded-card">`
);
replaceOnce(
  'public/whatsapp.html',
  `      <details class="wa-card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:700">Configuração manual avançada</summary>`,
  `        </div>
      </details>

      <details class="wa-card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:700">Configuração manual avançada</summary>`
);

let wjs=read('public/js/whatsapp.js');
wjs += `

// ---------- WAHA: conexão por número ----------
function waWahaBadge(texto,ok){
  const el=document.getElementById('wa-waha-status');
  if(!el)return;
  el.textContent=texto;
  el.classList.toggle('badge-ativo',Boolean(ok));
  el.classList.toggle('badge-inativo',!ok);
}
async function waConsultarWaha(){
  try{
    if(!waLojaId){const loja=await obterLojaAtual(); if(loja)waLojaId=loja.id;}
    if(!waLojaId)return;
    const s=await apiFetch('/lojas/'+waLojaId+'/whatsapp/waha/status');
    waWahaBadge(s.connected?'Conectado':(s.status==='NOT_FOUND'?'Não conectado':s.status),s.connected);
    if(s.connected) await waCarregarConfiguracao();
  }catch(_){}
}
const waWahaBotao=document.getElementById('wa-conectar-waha');
if(waWahaBotao) waWahaBotao.addEventListener('click',async()=>{
  waLimparErro();
  const campo=document.getElementById('wa-waha-numero');
  const codigo=document.getElementById('wa-waha-codigo');
  const phone=(campo&&campo.value||'').replace(/\\D/g,'');
  if(phone.length<10)return waErro('Digite o número com DDI e DDD.');
  waWahaBotao.disabled=true; waWahaBotao.textContent='Gerando código…'; codigo.textContent='';
  try{
    if(!waLojaId){const loja=await obterLojaAtual(); if(loja)waLojaId=loja.id;}
    const r=await apiFetch('/lojas/'+waLojaId+'/whatsapp/waha/pair',{method:'POST',body:JSON.stringify({phone_number:phone})});
    codigo.textContent=r.code||'';
    waWahaBadge('Aguardando confirmação',false);
    mostrarToast('Código gerado. Digite-o em Aparelhos conectados no WhatsApp.','sucesso');
  }catch(e){
    if(e instanceof SessaoExpiradaError)return fazerLogout();
    waErro(e.message||'Não foi possível gerar o código.');
    waWahaBadge('Falha ao conectar',false);
  }finally{
    waWahaBotao.disabled=false; waWahaBotao.textContent='Gerar código de conexão';
  }
});
setTimeout(waConsultarWaha,500);
setInterval(waConsultarWaha,10000);
`;
write('public/js/whatsapp.js',wjs);

console.log('Patch WAHA multi-tenant aplicado.');

// build-trigger: waha-integration
