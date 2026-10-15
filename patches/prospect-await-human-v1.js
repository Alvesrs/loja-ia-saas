'use strict';const fs=require('node:fs');
function edit(file,a,b){const s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('Await human anchor missing: '+file);fs.writeFileSync(file,s.replace(a,b));}
const waitSource=fs.readFileSync('patches/assets/ownerProspectWait.service.js','utf8');
const prompt='src/services/ownerSalesPrompt.js';
if(!fs.readFileSync(prompt,'utf8').includes('waitingRefusalBase'))fs.appendFileSync(prompt,"\nmodule.exports.prospectWait=(()=>{"+waitSource.replace("module.exports=","return ")+"\n})();\nconst waitingRefusalBase=module.exports.recusou;module.exports.recusou=v=>module.exports.prospectWait.waiting(v)?false:waitingRefusalBase(v);\n");
edit('src/services/ownerSalesAutomation.service.js',"const raw=String(v||'').trim(),s=norm(raw);if(!s)return false;", "const raw=String(v||'').trim(),s=norm(raw);if(!s)return false;\n if(prompt.prospectWait?.waiting(raw))return true;");
// Defense in depth: a direct seller invocation must not deactivate or generate a farewell either.
edit('src/services/salesSeller.service.js',"async function responder({lojaId,contato,pergunta,contextoComercial=false,dialogueContext}){", "async function responder({lojaId,contato,pergunta,contextoComercial=false,dialogueContext}){\n  if(require('./ownerSalesPrompt').prospectWait?.waiting(pergunta))return null;");
for(const file of ['public/cliente-versao.json','public/admin-versao.json']){const v=JSON.parse(fs.readFileSync(file,'utf8'));if(v.versao!=='2026.10.15.15'){v.versao='2026.10.15.15';v.novidades.unshift('Avisos de ausência e espera mantêm a prospecção aberta até a resposta humana');fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}}
