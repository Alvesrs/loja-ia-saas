const fs=require('node:fs');
for(const p of ['src/services/whatsappAtendente.service.js','src/services/whatsappWebhook.service.js']){if(fs.existsSync(p)) console.log('[wa-att-inspect]',p,'\n'+fs.readFileSync(p,'utf8'));}
