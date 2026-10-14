 'use strict';
const fs=require('node:fs');
const file='src/services/autoProspect.service.js';let s=fs.readFileSync(file,'utf8');
s=s.replace("async function search(batch,ctx){", "async function resolveContact(session,phone){try{return await require('./ownerProspecting.service').chatPorTelefone(session,phone);}catch(e){if(e.status===400&&e.message==='Este número não foi encontrado no WhatsApp conectado.')return null;throw e;}}\nasync function search(batch,ctx){");
s=s.replace("const contact=await require('./ownerProspecting.service').chatPorTelefone(ctx.cfg.identificador_externo,lead.telefone);", "const contact=await resolveContact(ctx.cfg.identificador_externo,lead.telefone);if(!contact)continue;");
s=s.replace("const renewAt=batch?new Date(Date.parse(batch.created_at)+12*3600000).toISOString():null;const remainingMs=renewAt?Math.max(0,Date.parse(renewAt)-Date.now()):0;return{batch,items,limit:15,renewAt,remainingMs,available:remainingMs===0,", "const quota=await checked(db.rpc('saintsai_prospect_quota',{p_loja_id:store.id}));return{batch,items,...quota,");
s=s.replace('module.exports={start,status,stop,tick,begin,end,createOpenings}', 'module.exports={start,status,stop,tick,begin,end,createOpenings,resolveContact}');
fs.writeFileSync(file,s);
for(const file of ['public/cliente-versao.json','public/admin-versao.json']){const v=JSON.parse(fs.readFileSync(file,'utf8'));v.versao='2026.10.14.10';v.novidades.unshift('Prospecção: ignora números sem WhatsApp e permite repetir buscas que falharam sem contatos');fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}
