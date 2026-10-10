const fs=require('node:fs');
fs.copyFileSync('patches/assets/owner-product-lab.service.js','src/services/ownerProductLab.service.js');
fs.copyFileSync('patches/assets/waha-buttons-adapter.js','src/services/providers/whatsapp/adaptadorWaha.js');
let atend=fs.readFileSync('src/services/whatsappAtendente.service.js','utf8');
const old='resposta:lab.response,productLab:true';
if(!atend.includes(old))throw Error('lab response routing anchor missing');
atend=atend.replace(old,'resposta:lab.response,productLab:true,...(lab.interativo?{interativo:lab.interativo}:{}),...(lab.voiceRequested?{voiceRequested:true}:{})');
fs.writeFileSync('src/services/whatsappAtendente.service.js',atend);
let worker=fs.readFileSync('src/services/whatsappWorker.service.js','utf8');
const voiceGuard='resposta.prospectAutomation||resposta.salesRefusal||resposta.productLab';
if(!worker.includes(voiceGuard))throw Error('lab voice guard anchor missing');
worker=worker.replace(voiceGuard,'resposta.prospectAutomation||resposta.salesRefusal||(resposta.productLab&&!resposta.voiceRequested)');
fs.writeFileSync('src/services/whatsappWorker.service.js',worker);
console.log('Laboratório: pedidos de voz e botões chegam ao envio; menus numéricos executáveis.');

let fila=fs.readFileSync('src/services/whatsappFila.service.js','utf8');
const queued='status: STATUS.PROCESSANDO,\n    tentativas: 1,\n    lease_ate: leaseAte,';
if(!fila.includes(queued))throw Error('enqueue lease anchor missing');
fila=fila.replace(queued,'status: STATUS.PENDENTE,\n    tentativas: 0,\n    lease_ate: null,');
fs.writeFileSync('src/services/whatsappFila.service.js',fila);
// Voice generation + delivery may outlast the old 60 s lease. Keep a claimed
// worker exclusive for the bounded 90 s generation and 45 s delivery budget.
fila=fila.replace("leaseSegundos: inteiroAmbiente('WHATSAPP_WORKER_LEASE_SEGUNDOS', 60, 10, 3600)","leaseSegundos: Math.max(180, inteiroAmbiente('WHATSAPP_WORKER_LEASE_SEGUNDOS', 180, 10, 3600))");
fs.writeFileSync('src/services/whatsappFila.service.js',fila);
let parser=fs.readFileSync('src/services/providers/whatsapp/interpretadorWebhookWaha.js','utf8');
const textAnchor='  const texto = primeiroTexto(\n    p.body,';
if(!parser.includes(textAnchor))throw Error('WAHA selection parser anchor missing');
parser=parser.replace(textAnchor,"  const texto = primeiroTexto(\n    p._data?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,\n    p._data?.listResponse?.singleSelectReply?.selectedRowId,\n    p.body,");
fs.writeFileSync('src/services/providers/whatsapp/interpretadorWebhookWaha.js',parser);
