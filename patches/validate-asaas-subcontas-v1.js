const fs=require('node:fs');
const cp=require('node:child_process');
function need(file,parts){const s=fs.readFileSync(file,'utf8');for(const p of parts)if(!s.includes(p))throw new Error(file+' sem '+p);return s;}
const app=need('src/app.js',["app.use('/api/pagamentos/asaas', asaasSubcontaRoutes);","app.use('/api/pagamentos/asaas/subconta', asaasSubcontaWebhookRoutes);"]);
const cfg=need('public/cliente-configuracao.html',['Asaas e formas de pagamento','Ativar pagamentos Asaas',"/pagamentos/asaas/lojas/"]);
const hub=need('src/controllers/clienteHub.controller.js',["id:'asaas',titulo:'Ative pagamentos Asaas'"]);
const booking=need('src/services/bookingPublic.service.js',["const asaasPix=require('./asaasAgendamentoPix.service');","c.provedor==='asaas'","asaasPix.criarPixParaAgendamento"]);
const agenda=need('src/services/agendaWhatsapp.service.js',["const asaasPix=require('./asaasAgendamentoPix.service');","pagCfg?.provedor==='asaas'","asaasPix.criarPixParaAgendamento"]);
const worker=need('src/services/whatsappWorker.service.js',["const asaasPix = require('./asaasAgendamentoPix.service');","asaasPix.expirarReservas()"]);
const sub=need('src/services/asaasSubconta.service.js',["/v3/accounts","saintsai_store_payment_secret","provedor:'asaas'","PAYMENT_CONFIRMED","PAYMENT_RECEIVED"]);
const pix=need('src/services/asaasAgendamentoPix.service.js',["/v3/pix/addressKeys","/v3/pix/qrCodes/static","PAYMENT_CONFIRMED","pagamento_status='pago'","confirmarWhatsapp"]);
need('src/controllers/asaasSubcontaWebhook.controller.js',["asaas-access-token","timingSafeEqual"]);
for(const p of ['src/services/asaasSubconta.service.js','src/controllers/asaasSubconta.controller.js','src/routes/asaasSubconta.routes.js','src/services/asaasAgendamentoPix.service.js','src/controllers/asaasSubcontaWebhook.controller.js','src/routes/asaasSubcontaWebhook.routes.js'])cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
if(cfg.includes('PagBank e formas de pagamento'))throw new Error('UI final ainda mostra PagBank');
if(booking.includes("c.provedor==='pagbank'"))throw new Error('Booking final ainda depende de PagBank');
console.log('[asaas-final] PASS subcontas, Pix, webhook, agenda, worker e UI');