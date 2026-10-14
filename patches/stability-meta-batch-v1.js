'use strict';
const fs=require('node:fs');
const file='src/controllers/whatsappWebhook.controller.js';
let s=fs.readFileSync(file,'utf8');
if(s.includes('// stability: persist every valid Meta message'))process.exit(0);
function replace(from,to){if(!s.includes(from))throw Error('Meta batch anchor missing');s=s.replace(from,to);}
replace('Só a primeira mensagem de texto válida é enfileirada (limitação herdada).','Todas as mensagens de texto válidas são enfileiradas antes de confirmar o lote.');
replace('  // Evento genérico entregue ao service da 10C:',`  // stability: persist every valid Meta message
  let recebidas = 0;
  for (const mensagemTexto of mensagensInterpretadas.filter(m => m.valida && m.suportada && m.tipo === TIPOS_MENSAGEM_WEBHOOK.texto)) {
  // Evento genérico entregue ao service da 10C:`);
replace('      return res.status(200).json({ status: MENSAGENS.duplicadoIgnorado });','      continue;');
replace('    res.status(200).json({ status: MENSAGENS.recebido });\n    return res;','    recebidas += 1;');
replace('    return responderErroInterno(res, erro);\n  }\n}\n\n/**\n * Tratador', '    return responderErroInterno(res, erro);\n  }\n  }\n  return res.status(200).json({ status: recebidas ? MENSAGENS.recebido : MENSAGENS.duplicadoIgnorado });\n}\n\n/**\n * Tratador');
fs.writeFileSync(file,s);
