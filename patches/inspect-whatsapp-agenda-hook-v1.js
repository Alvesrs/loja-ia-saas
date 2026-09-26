const fs=require('node:fs');
for(const p of ['src/services/whatsappWorker.service.js','src/services/whatsappWebhook.service.js','src/services/llm.service.js']){
  console.log('\n===== '+p+' =====');
  if(!fs.existsSync(p)){console.log('ARQUIVO_NAO_ENCONTRADO');continue;}
  const s=fs.readFileSync(p,'utf8');
  console.log(s.slice(0,18000));
}
