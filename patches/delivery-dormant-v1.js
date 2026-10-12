'use strict';
const fs=require('node:fs');
// Deliberately dormant for every company. Reactivation requires a future release.
fs.writeFileSync('src/services/deliveryFeature.service.js',"'use strict';module.exports={enabled:false};\n");
const edit=(file,fn)=>{const s=fs.readFileSync(file,'utf8'),next=fn(s);if(s===next)throw Error('Dormant delivery anchor missing: '+file);fs.writeFileSync(file,next);};
edit('src/services/entregaWhatsapp.service.js',s=>s.replace('async function tentar(m){','async function tentar(m){if(!require(\'./deliveryFeature.service\').enabled)return null;'));
edit('src/routes/saintsaiEntrega.routes.js',s=>s.replace('r.use(express.json',"r.use((req,res,next)=>require('../services/deliveryFeature.service').enabled?next():res.status(404).json({erro:'Recurso indisponível.'}));r.use(express.json"));
edit('public/js/client-shell-v7.js',s=>s.replace(",['Entregas','cliente-entregas.html','truck']",''));
for(const name of fs.readdirSync('public').filter(x=>x.endsWith('.html')&&x!=='cliente-entregas.html')){
 const file='public/'+name,s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,s.replace(/<a\b[^>]*href=["'][^"']*cliente-entregas\.html[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,''));
}
fs.writeFileSync('public/cliente-entregas.html','<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=cliente-central.html"><title>SaintsAI</title></head><body><a href="cliente-central.html">Voltar ao início</a><script>location.replace("cliente-central.html")</script></body></html>');
edit('src/services/iaPrompt.service.js',s=>s.replace('const SYSTEM_PROMPT_ATENDENTE = `','const SYSTEM_PROMPT_ATENDENTE = `\nO módulo de entregas do aplicativo está desativado. Não ofereça opções, botões, demonstrações, cobrança ou registro automático de entrega ou retirada. Se perguntarem, encaminhe ao responsável humano para combinar diretamente; não prometa ativação nem acesso a esse módulo.'));
const file='public/cliente-versao.json',v=JSON.parse(fs.readFileSync(file));fs.writeFileSync(file,JSON.stringify({...v,versao:'2026.10.11.28',novidades:['Entregas ocultadas e fluxo automático pausado']},null,2)+'\n');
require('node:child_process').execFileSync(process.execPath,['--test','tests/delivery-dormant.test.cjs'],{stdio:'inherit'});
