const fs=require('node:fs');
for(const p of ['src/services/whatsappEnvio.service.js','src/services/whatsappWorker.service.js','src/services/whatsappConfiguracao.service.js']){
 console.log('\n[agenda-reminder-inspect] '+p);
 if(!fs.existsSync(p)){console.log('NAO_ENCONTRADO');continue;}
 console.log(fs.readFileSync(p,'utf8').slice(0,22000));
}
