'use strict';const fs=require('node:fs');
fs.copyFileSync('patches/assets/tenantHumanControl.service.js','src/services/tenantHumanControl.service.js');
const p='src/controllers/whatsappWahaWebhook.controller.js';let s=fs.readFileSync(p,'utf8');
if(!s.includes('let tenantControl')){
 const anchor='  try {\n    const salesContext=';if(!s.includes(anchor))throw Error('Tenant route anchor missing');
 s=s.replace(anchor,`  let tenantControl;
  try{tenantControl=await require('../services/tenantHumanControl.service').route(evento);if(tenantControl?.status)return res.status(200).json({status:tenantControl.status});}catch(_){return res.status(503).json({erro:'Não foi possível verificar atendimento humano.'});}
${anchor}`);
 s=s.replace('  // Pausa de 10 minutos para todas as lojas conectadas por WAHA.',"  if(!tenantControl?.tenant){\n  // Legacy handoff remains when durable mode is disabled.");
 s=s.replace("  const chaveId={provedor:'waha',idExterno:evento.idExterno};","  }\n  const chaveId={provedor:'waha',idExterno:evento.idExterno};");fs.writeFileSync(p,s);
}
const h='src/services/ownerMinuteHandoff.service.js';s=fs.readFileSync(h,'utf8');
if(!s.includes('// tenant human control')){
 s=s.replace('async function before(job){',"async function before(job){/* tenant human control */if(process.env.WHATSAPP_DURABLE_BATCH==='1'){const gate=await require('./tenantHumanControl.service').before(job);if(gate!=='ready')return gate;}");
 s=s.replace('async function canSend(job,response){',"async function canSend(job,response){if(process.env.WHATSAPP_DURABLE_BATCH==='1'&&!await require('./tenantHumanControl.service').canSend(job))return false;");
 s=s.replace('module.exports.due=async(job)=>{',"module.exports.due=async(job)=>{if(process.env.WHATSAPP_DURABLE_BATCH==='1'){const due=await require('./tenantHumanControl.service').due(job);if(due)return due;}");
 fs.writeFileSync(h,s+'\n// tenant human control\n');
}
