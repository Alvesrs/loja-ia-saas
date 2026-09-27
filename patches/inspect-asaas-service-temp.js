const fs=require('node:fs');
const f='src/services/asaas.service.js';
const s=fs.readFileSync(f,'utf8');
for(const term of ['function chamarAsaas','async function chamarAsaas','customer','customers','criarCheckoutAssinatura','function configurado']){
 const i=s.indexOf(term);
 console.log('[ASAAS_INSPECT]',term,i,i>=0?'\n'+s.slice(Math.max(0,i-1800),i+7000):'');
}