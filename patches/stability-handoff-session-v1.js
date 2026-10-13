'use strict';
const fs=require('node:fs');const file='src/services/ownerMinuteHandoff.service.js';let s=fs.readFileSync(file,'utf8');
if(s.includes('async function convo(lojaId,contato,sessionId)'))process.exit(0);
const changes=[['async function convo(lojaId,contato)','async function convo(lojaId,contato,sessionId)'],[".eq('loja_id',lojaId).eq('contato',contato).maybeSingle()",".eq('loja_id',lojaId).eq('contato',contato).eq('session_id',sessionId).maybeSingle()"],['convo(cfg.loja_id,e.contato)','convo(cfg.loja_id,e.contato,e.destinatarioId)'],['convo(job.loja_id,job.contato)','convo(job.loja_id,job.contato,job.destinatario_id)']];
for(const [a,b]of changes){if(!s.includes(a))throw Error('Handoff session anchor missing');s=s.split(a).join(b)}fs.writeFileSync(file,s);
