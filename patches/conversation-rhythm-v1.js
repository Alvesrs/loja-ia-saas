'use strict';const fs=require('node:fs');
function edit(file,a,b){const s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(!s.includes(a))throw Error('Conversation rhythm anchor missing: '+file);fs.writeFileSync(file,s.replace(a,b));}
fs.copyFileSync('patches/assets/conversationRhythm.service.js','src/services/conversationRhythm.service.js');
edit('src/services/salesSeller.service.js','systemPrompt:(promptDono||SYSTEM_PROMPT)',"systemPrompt:(promptDono||SYSTEM_PROMPT)+'\\n'+require('./conversationRhythm.service').GUIDANCE");
edit('src/services/iaPrompt.service.js','systemPrompt: montarSystemPrompt(promptMestreLoja),',"systemPrompt: montarSystemPrompt(promptMestreLoja)+'\\n'+require('./conversationRhythm.service').GUIDANCE,");
const worker='src/services/whatsappWorker.service.js';
edit(worker,"const resposta = require('./ownerSalesMediaClean.service').clean", "let resposta = require('./ownerSalesMediaClean.service').clean");
edit(worker,'        await envio.enviarRespostaWhatsapp(mensagem, resposta, contexto);',`        if((resposta.salesDialogue||resposta.tenantDialogue)&&resposta.resposta.length>=160){
        const ritmo=await require('./conversationRhythm.service').send({job,mensagem,resposta,contexto,enviar:envio.enviarRespostaWhatsapp});
        if(!ritmo.enviadas){await idempotencia.concluirEventoWhatsapp({provedor:job.provedor,idExterno:job.id_externo});await fila.concluirJob(job.id);return Object.freeze({ok:true,id:job.id,silencioso:true});}
        resposta={...resposta,resposta:ritmo.texto};
        }else{await envio.enviarRespostaWhatsapp(mensagem,resposta,contexto);}`);
for(const file of ['public/cliente-versao.json','public/admin-versao.json']){const v=JSON.parse(fs.readFileSync(file,'utf8'));v.versao='2026.10.15.18';v.novidades.unshift('Conversa mais natural, venda consultiva e respostas em até duas mensagens curtas');fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}
for(const file of ['src/services/salesSeller.service.js','src/services/iaPrompt.service.js','src/services/whatsappWorker.service.js'])new (require('node:vm').Script)(fs.readFileSync(file,'utf8'),{filename:file});
console.log('[conversation-rhythm] tom consultivo e sequências curtas habilitados com interrupção por nova mensagem ou atendimento humano');
