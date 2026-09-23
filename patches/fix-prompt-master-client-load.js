const fs=require('node:fs');
const p='public/js/atendente.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace("const cliente = await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaAtualIdChat));","let cliente = {}; try { cliente = JSON.parse(sessionStorage.getItem(LOJA_CACHE_KEY) || '{}') || {}; } catch (_) {} if (!cliente.nome) throw new Error('Nome da loja indisponível.');");
s=s.replace("numero_whatsapp: cliente.whatsapp && cliente.whatsapp.numero_whatsapp || ''","numero_whatsapp: ''");
fs.writeFileSync(p,s);
console.log('Correção de salvamento da Prompt Mestre aplicada.');
