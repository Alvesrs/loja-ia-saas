const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,v){fs.writeFileSync(p,v)}

const parserPath='src/services/providers/whatsapp/interpretadorWebhookWaha.js';
let p=read(parserPath);
p=p.replace(
"  if (p.fromMe === true) return null;\n  if (!ehStringNaoVazia(p.id) || !ehStringNaoVazia(p.from)) throw new ErroWebhookWahaInvalido();\n  if (!p.from.endsWith('@c.us') && !p.from.endsWith('@lid')) return null;",
"  const fromMe = p.fromMe === true;\n  const contatoBruto = fromMe ? p.to : p.from;\n  if (!ehStringNaoVazia(p.id) || !ehStringNaoVazia(contatoBruto)) throw new ErroWebhookWahaInvalido();\n  if (!contatoBruto.endsWith('@c.us') && !contatoBruto.endsWith('@lid')) return null;"
);
p=p.replace(
"    contato: p.from.trim(),\n    texto: p.body.trim(),",
"    contato: contatoBruto.trim(),\n    texto: p.body.trim(),\n    fromMe,"
);
write(parserPath,p);

const controllerPath='src/controllers/whatsappWahaWebhook.controller.js';
let c=read(controllerPath);
c=c.replace(
"const idempotenciaService = require('../services/whatsappIdempotencia.service');",
"const idempotenciaService = require('../services/whatsappIdempotencia.service');\nconst supabase = require('../config/supabase');"
);
c=c.replace(
"const CONTEXTO = Object.freeze({provedor:'waha'});",
"const GATILHO_VENDAS = 'oi! tudo bem? vi a empresa de vocês e queria te mostrar uma ferramenta que estou lançando. ela atende clientes automaticamente pelo whatsapp, responde dúvidas sobre produtos e ajuda a não perder vendas quando ninguém consegue responder na hora. posso te mostrar rapidinho como funciona?';\\n\\nfunction normalizarTextoVenda(valor){\\n  return String(valor||'').trim().toLowerCase().replace(/\\\\s+/g,' ');\\n}\\n\\nasync function ativarConversaVenda(evento){\\n  const payload={\\n    session_id:evento.destinatarioId,\\n    contato:evento.contato,\\n    ativo:true,\\n    atualizado_em:new Date().toISOString(),\\n    ultimo_evento_id:evento.idExterno\\n  };\\n  const {error}=await supabase.from('saintsai_sales_conversations')\\n    .upsert(payload,{onConflict:'session_id,contato'});\\n  if(error) throw error;\\n}\\n\\nasync function desativarConversaVenda(evento){\\n  const {error}=await supabase.from('saintsai_sales_conversations')\\n    .update({ativo:false,atualizado_em:new Date().toISOString(),ultimo_evento_id:evento.idExterno})\\n    .eq('session_id',evento.destinatarioId).eq('contato',evento.contato);\\n  if(error) throw error;\\n}\nconst CONTEXTO = Object.freeze({provedor:'waha'});"
);
c=c.replace(
"  if (!evento) return res.status(200).json({status:'sem_mensagem_processavel'});\n\n  const chaveId={provedor:'waha',idExterno:evento.idExterno};",
"  if (!evento) return res.status(200).json({status:'sem_mensagem_processavel'});\n\n  if (evento.fromMe === true) {\n    try {\n      const texto=normalizarTextoVenda(evento.texto);\n      if (texto === GATILHO_VENDAS) {\n        await ativarConversaVenda(evento);\n        console.log('[waha.sales] conversa_ativada', evento.contato);\n        return res.status(200).json({status:'vendedor_saintsai_ativado'});\n      }\n      if (texto === '/parar') {\n        await desativarConversaVenda(evento);\n        console.log('[waha.sales] conversa_desativada', evento.contato);\n        return res.status(200).json({status:'vendedor_saintsai_desativado'});\n      }\n      return res.status(200).json({status:'mensagem_propria_ignorada'});\n    } catch (erro) {\n      console.error('[waha.sales] erro_gatilho', erro && (erro.stack || erro.message || erro));\n      return res.status(500).json({erro:'Não foi possível atualizar o modo de vendas.'});\n    }\n  }\n\n  const chaveId={provedor:'waha',idExterno:evento.idExterno};"
);
write(controllerPath,c);
console.log('Vendedor SaintsAI: detecção segura de gatilho aplicada.');