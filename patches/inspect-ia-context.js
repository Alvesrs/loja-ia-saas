const fs=require('node:fs');
for(const p of ['src/services/ia.service.js','src/controllers/ia.controller.js','src/routes/ia.routes.js','src/services/llm.service.js','src/services/llmCliente.service.js']){if(fs.existsSync(p)) console.log('[ia-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));}

for(const p of ['src/services/whatsappWorker.service.js','src/services/whatsappHistorico.service.js','src/services/iaPrompt.service.js']){if(fs.existsSync(p)) console.log('[ia-extra-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));}
