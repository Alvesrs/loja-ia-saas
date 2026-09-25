const fs=require('node:fs');
const cp=require('node:child_process');
const path='src/services/providers/whatsapp/interpretadorWebhookWaha.js';
fs.writeFileSync(path, `
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

function primeiroTexto(...valores){
  for(const v of valores){ if(typeof v==='string' && v.trim()) return v.trim(); }
  return '';
}

function primeiroBool(...valores){
  for(const v of valores){ if(v===true || v===false) return v; }
  return false;
}

function extrairId(p){
  const candidatos=[
    typeof p.id==='string' ? p.id : null,
    p.id && p.id.id,
    p.key && p.key.id,
    p._data && p._data.id && p._data.id.id,
    p._data && p._data.id && p._data.id._serialized
  ];
  return candidatos.find(ehStringNaoVazia) || '';
}

function interpretarPayloadWebhookWaha(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErroWebhookWahaInvalido();
  if (body.event !== 'message' && body.event !== 'message.any') return null;
  if (!ehStringNaoVazia(body.session)) throw new ErroWebhookWahaInvalido();

  const p = body.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ErroWebhookWahaInvalido();

  const fromMe = primeiroBool(
    p.fromMe,
    p.key && p.key.fromMe,
    p.id && p.id.fromMe,
    p._data && p._data.fromMe,
    p._data && p._data.id && p._data.id.fromMe
  );

  const remoto = primeiroTexto(
    p.chatId,
    p.key && p.key.remoteJid,
    p.id && p.id.remote,
    p._data && p._data.id && p._data.id.remote
  );
  const contatoBruto = fromMe
    ? primeiroTexto(p.to, p._data && p._data.to, remoto, p.from)
    : primeiroTexto(p.from, p._data && p._data.from, remoto, p.to);

  if (!ehStringNaoVazia(contatoBruto)) throw new ErroWebhookWahaInvalido();
  if (!contatoBruto.endsWith('@c.us') && !contatoBruto.endsWith('@lid')) return null;

  const texto = primeiroTexto(
    p.body,
    p.text,
    typeof p.message==='string' ? p.message : '',
    p._data && p._data.body,
    p._data && p._data.caption
  );
  if (!texto) return null;

  const idExterno = extrairId(p);
  if (!idExterno) throw new ErroWebhookWahaInvalido();

  return Object.freeze({
    destinatarioId: body.session.trim(),
    contato: contatoBruto,
    texto,
    idExterno,
    timestamp: timestampIso(p.timestamp || (p._data && p._data.t)),
    fromMe,
    source: primeiroTexto(p.source, p._data && p._data.source, body.source).toLowerCase(),
  });
}

module.exports = { interpretarPayloadWebhookWaha, ErroWebhookWahaInvalido };
`);

const ctrl='src/controllers/whatsappWahaWebhook.controller.js';
let c=fs.readFileSync(ctrl,'utf8');
if(!c.includes("[waha.sales] outgoing_detectado")){
  c=c.replace(
    "      const texto=normalizarTextoVenda(evento.texto);",
    "      const texto=normalizarTextoVenda(evento.texto);\n      console.log('[waha.sales] outgoing_detectado', JSON.stringify({contato:evento.contato,source:evento.source||'',gatilho:texto===GATILHO_VENDAS,parar:texto==='/parar'}));"
  );
}
fs.writeFileSync(ctrl,c);

cp.execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',ctrl],{stdio:'inherit'});
console.log('Parser WAHA robusto para mensagens de saída aplicado.');