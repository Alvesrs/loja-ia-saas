const fs=require('node:fs');
for(const [asset,target] of [['sales-voice-chatterbox.service.js','salesVoice.service.js'],['chatterbox-voice.service.js','chatterboxVoice.service.js'],['chatterbox-test-once.service.js','chatterboxTestOnce.service.js']])fs.copyFileSync('patches/assets/'+asset,'src/services/'+target);
let server=fs.readFileSync('src/server.js','utf8');
if(!server.includes('chatterboxTestOnce'))server+="\nsetTimeout(()=>require('./services/chatterboxTestOnce.service').run().catch(e=>console.error('[chatterbox.test] falha',e.message)),6000);\n";
fs.writeFileSync('src/server.js',server);
console.log('Chatterbox PT-BR: voz da demo, apenas a pedido, teste único autorizado.');

let seller=fs.readFileSync('src/services/salesSeller.service.js','utf8');
seller=seller.replace(/return 'Claro\. O SaintsAI funciona como um atendente inteligente dentro do WhatsApp da empresa\.[^']*';/,"return 'Enquanto você está ocupado, o SaintsAI pode responder com os dados do negócio e ajudar a concluir um agendamento, conforme a agenda configurada. Quer um exemplo de barbearia?';");
fs.writeFileSync('src/services/salesSeller.service.js',seller);
