const fs=require('node:fs');
const p='src/controllers/admin.controller.js';
let c=fs.readFileSync(p,'utf8');

// whatsapp_configuracoes usa created_at, não criado_em.
c=c.replaceAll(".order('criado_em', { ascending: false })", ".order('created_at', { ascending: false })");
c=c.replaceAll(".order('criado_em',{ascending:false})", ".order('created_at',{ascending:false})");

fs.writeFileSync(p,c);
console.log('Admin cliente WhatsApp: ordenação corrigida para created_at.');
