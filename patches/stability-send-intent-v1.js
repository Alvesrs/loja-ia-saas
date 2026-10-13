'use strict';
const fs=require('node:fs');
fs.copyFileSync('patches/assets/whatsappSendIntent.service.js','src/services/whatsappSendIntent.service.js');
const file='src/services/whatsappWorker.service.js';
let source=fs.readFileSync(file,'utf8');
function change(from,to){if(source.includes(to))return;if(!source.includes(from))throw Error('Send intent anchor missing');source=source.replace(from,to);}
change("  let etapa = 'historico_entrada';", "  let etapa = 'historico_entrada';\n  let sendIntent=false;\n  const intent=require('./whatsappSendIntent.service');");
change("    if (job.status !== fila.STATUS.ENVIADO) {", "    if (job.status !== fila.STATUS.ENVIADO) {\n      if(intent.uncertain(job)){sendIntent=true;await intent.quarantine(job);return Object.freeze({ok:false,id:job.id,revisaoEnvio:true});}");
change("      etapa = 'voz';", "      etapa = 'intencao_envio';\n      if(!await intent.prepare(job,resposta))return Object.freeze({ok:false,id:job.id,leasePerdida:true});\n      sendIntent=true;\n      if(!await require('./ownerMinuteHandoff.service').canSend(job,resposta)){await idempotencia.concluirEventoWhatsapp({provedor:job.provedor,idExterno:job.id_externo});await fila.concluirJob(job.id);return Object.freeze({ok:true,id:job.id,silencioso:true});}\n      etapa = 'voz';");
change("    try {\n      await fila.reagendarOuFalharJob(job, codigoErro(erro));", "    if(sendIntent){try{await intent.quarantine(job);}catch(_){console.error('[whatsapp.worker] revisao_envio_pendente',{jobId:job.id});}return Object.freeze({ok:false,id:job.id,revisaoEnvio:true});}\n    try {\n      await fila.reagendarOuFalharJob(job, codigoErro(erro));");
fs.writeFileSync(file,source);
