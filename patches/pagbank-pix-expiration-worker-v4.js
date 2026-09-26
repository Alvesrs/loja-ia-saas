const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
let w=read('src/services/whatsappWorker.service.js');
if(!w.includes("pagBankPix")){
 w=w.replace("const agendaLembretes = require('./agendaLembretes.service');","const agendaLembretes = require('./agendaLembretes.service');\nconst pagBankPix = require('./pagBankPix.service');");
 const n="try{const lr=await agendaLembretes.processarLembretes();if(lr&&lr.enviados)console.log('[agenda.lembretes] enviados',lr.enviados);}\n    catch(erro){console.error('[agenda.lembretes] falha',{tipo:erro?.name||'Error',codigo:erro?.code||null});}";
 if(!w.includes(n))throw new Error('Hook lembretes completo não encontrado');
 w=w.replace(n,n+"\n    try{const ex=await pagBankPix.expirarReservas();if(ex)console.log('[agenda.pix] reservas expiradas',ex);}catch(erro){console.error('[agenda.pix] falha expiração',{tipo:erro?.name||'Error'});}");
}
write('src/services/whatsappWorker.service.js',w);
cp.execFileSync(process.execPath,['--check','src/services/whatsappWorker.service.js'],{stdio:'inherit'});
console.log('Expiração de reservas Pix ligada ao worker.');