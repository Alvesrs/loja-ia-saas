'use strict';const fs=require('node:fs'),path=require('node:path'),assets=path.join(__dirname,'assets/release-audit');
const edit=(file,fn)=>{const s=fs.readFileSync(file,'utf8'),v=fn(s);if(s===v)throw Error('Release audit anchor missing: '+file);fs.writeFileSync(file,v);};
fs.copyFileSync(path.join(assets,'accountCare.controller.js'),'src/controllers/accountCare.controller.js');
for(const f of ['cliente-recuperar.html','admin-exclusoes.html'])fs.copyFileSync(path.join(assets,f),'public/'+f);
for(const f of ['cliente-recuperar.js','cliente-conta.js'])fs.copyFileSync(path.join(assets,f),'public/js/'+f);
edit('src/routes/auth.routes.js',s=>s.replace('module.exports = router;',`const care=require('../controllers/accountCare.controller');
const limitCare=criarRateLimiter({janelaMs:15*60_000,maxRequisicoes:6,mensagem:'Aguarde alguns minutos antes de tentar novamente.'});
router.post('/recuperar-senha',limitCare,care.recuperar);
router.post('/redefinir-senha',limitCare,care.redefinir);
router.get('/exclusao-conta',exigirLogin,care.status);
router.post('/exclusao-conta',limitCare,exigirLogin,care.solicitarExclusao);
router.get('/admin/exclusoes',exigirLogin,require('../middleware/admin').exigirAdmin,care.listar);
module.exports = router;`));
edit('public/cliente-login.html',s=>s.replace('</form><p','</form><p><a href="cliente-recuperar.html" style="color:#cbb8ed">Esqueci minha senha</a></p><p').replace("    ocultarErro();","    if(botao.disabled)return;\n    ocultarErro();").replace('</body>','<p style="text-align:center"><a href="/politica-de-privacidade">Privacidade</a> · <a href="/exclusao-de-dados">Excluir conta</a> · <a href="mailto:pealves434@gmail.com?subject=Suporte%20SaintsAI">Suporte</a></p></body>'));
edit('public/cliente-seguranca.html',s=>s.replace('</main>',`<section id="sa-account-care" style="margin-top:24px;padding:24px;background:#1c1925;border:1px solid #3b3147;border-radius:18px"><h2>Conta e dados</h2><p><a href="/politica-de-privacidade">Política de privacidade</a> · <a href="mailto:pealves434@gmail.com?subject=Suporte%20SaintsAI">Suporte</a></p><h3>Solicitar exclusão da conta</h3><p>A solicitação inclui sua conta e os dados vinculados à sua empresa. O suporte confirmará a titularidade e informará os registros que precisam ser mantidos por obrigações legais ou disputas. A solicitação não cancela cobranças já emitidas automaticamente.</p><form id="sa-deletion-form"><label for="sa-deletion-confirm">Digite EXCLUIR para confirmar</label><input id="sa-deletion-confirm" required autocomplete="off" maxlength="7"><button id="sa-deletion-submit" type="submit">Solicitar exclusão</button></form><p id="sa-deletion-status" role="status"></p></section></main>`).replace('</body>','<script src="js/cliente-conta.js?v=2026.10.11.29"></script></body>'));
edit('public/admin-mobile.html',s=>s.replace('<a href="admin-status.html"','<a href="admin-exclusoes.html" style="display:inline-flex;align-items:center;padding:12px;color:#fff">Solicitações de exclusão</a><a href="admin-status.html"'));
edit('public/legal/exclusao/index.html',s=>s.replace('Loja IA SaaS','SaintsAI (Loja IA SaaS)').replace('<h2>Como solicitar</h2>',`<h2>Excluir sua conta SaintsAI</h2><p>No aplicativo, abra Segurança e acesso → Conta e dados → Solicitar exclusão. Você receberá um protocolo. Se não conseguir entrar, <a href="mailto:pealves434@gmail.com?subject=Exclus%C3%A3o%20de%20conta%20SaintsAI">solicite a exclusão por e-mail ao suporte</a>, informando o e-mail da conta e o nome da empresa. Não é necessário reinstalar o aplicativo. Confirmaremos sua titularidade antes de processar a exclusão da conta e dos dados associados.</p><p>Registros financeiros necessários a obrigações legais, prevenção de fraude ou disputas podem ser preservados pelo período aplicável; o suporte informará essas exceções ao responder à solicitação.</p><h2>Dados de consumidores atendidos pelas empresas</h2>`));
edit('public/legal/privacidade/index.html',s=>s.replace(/Loja IA SaaS/g,'SaintsAI (Loja IA SaaS)').replace('20 de setembro de 2026','11 de outubro de 2026').replace('<h2>5. Retenção e segurança</h2>',`<h2>Notificações, mídias e segurança do dispositivo</h2><p>Usamos identificadores de dispositivo e tokens do Firebase Cloud Messaging para entregar notificações autorizadas. Fotos e vídeos selecionados pelo usuário são enviados para a galeria da empresa. Dados de agendamento incluem nome, contato, serviço, profissional, data e horário. Pagamentos são processados pelo provedor conectado; não solicitamos senha bancária. A biometria é verificada pelo Android: não recebemos nem armazenamos impressões digitais. Não usamos esses dados para publicidade comportamental.</p><p>Você pode falar com o suporte pelo <a href="mailto:pealves434@gmail.com">e-mail de atendimento SaintsAI</a>.</p><h2>5. Retenção e segurança</h2>`));
// Ignore synthetic second submissions while an existing checkout request is in flight.
edit('public/comprar.html',s=>s.replace("e.preventDefault();if(!selecionado)","e.preventDefault();if($('comprar').disabled)return;if(!selecionado)").replace('minlength="6"','minlength="10"'));
edit('src/controllers/compraPublica.controller.js',s=>s.replace('senha.length<6','senha.length<10').replace('pelo menos 6 caracteres','pelo menos 10 caracteres'));
const v=JSON.parse(fs.readFileSync('public/cliente-versao.json'));fs.writeFileSync('public/cliente-versao.json',JSON.stringify({...v,versao:'2026.10.11.29',novidades:['Recuperação de acesso e suporte no login','Solicitação de exclusão com protocolo','Proteções de cadastro e privacidade revisadas']},null,2)+'\n');
require('node:child_process').execFileSync(process.execPath,['--test','tests/release-account-care.test.cjs'],{stdio:'inherit'});
fs.copyFileSync(path.join(assets,'play-distribution.js'),'public/js/play-distribution.js');
for(const name of fs.readdirSync('public').filter(n=>/^cliente-.*\.html$/.test(n)&&n!=='cliente-entregas.html')){const file='public/'+name,s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,s.replace('</body>','<script src="js/play-distribution.js?v=2026.10.11.29"></script></body>'));}
for(const f of ['saleNotificationRetry.service.js','asaasSubcontaWebhook.controller.js'])fs.copyFileSync(path.join(assets,f),'src/'+(f.includes('controller')?'controllers/':'services/')+f);
edit('src/services/asaasAgendamentoPix.service.js',s=>{s=s.replace("if(!ag)return {ignorado:true};const now=",`if(!ag)return {ignorado:true};if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(i.event)){const value=Number(payload.payment?.value),expected=Number(ag.valor);if(!Number.isFinite(value)||value<=0||!Number.isFinite(expected)||Math.round(value*100)!==Math.round(expected*100)||(i.pixId&&i.pixId!==ag.pagamento_referencia)){const e=Error('Pagamento incompatível');e.code='PIX_PAYMENT_MISMATCH';throw e;}}const now=`);s=s.replace("let update=supabase.from('saintsai_agendamentos')","if(i.event==='PAYMENT_RECEIVED')u.notificacao_venda_enfileirada=true;let update=supabase.from('saintsai_agendamentos')");const start=s.indexOf("if(i.event==='PAYMENT_RECEIVED'&&data&&ag.pagamento_provider_status!=='PAYMENT_RECEIVED')");const end=s.indexOf('return {ok:true};}',start);if(start<0||end<0)throw Error('Sale push anchor missing');return s.slice(0,start)+s.slice(end);});
edit('src/server.js',s=>s.replace('  iniciarWorker();',"  iniciarWorker();\n  require('./services/saleNotificationRetry.service').start();").replace('  pararWorker();',"  pararWorker();\n  require('./services/saleNotificationRetry.service').stop();"));
require('node:child_process').execFileSync(process.execPath,['--test','tests/release-payments.test.cjs'],{stdio:'inherit'});

require("node:child_process").execFileSync(process.execPath,["--test","tests/sale-notification-retry.test.cjs"],{stdio:"inherit"});

edit('src/middleware/auth.js',s=>s.replace("'/api/auth/primeiro-acesso/status'","'/api/auth/primeiro-acesso/status','/api/auth/exclusao-conta'"));
edit('public/js/seguranca-app.js',s=>s.replace(/1\.2\.6/g,'1.2.19'));
edit('public/cliente-seguranca.html',s=>s.replace(/js\/seguranca-app\.js\?v=[^\"]+/g,'js/seguranca-app.js?v=2026.10.11.29'));

edit('public/js/first-access.js',s=>s.replace("e.preventDefault();erro.textContent=''","e.preventDefault();if(button.disabled||!form.reportValidity())return;erro.textContent=''"));
edit('public/cliente-primeiro-acesso.html',s=>s.replace('src="js/first-access.js"','src="js/first-access.js?v=2026.10.11.29"'));

edit('src/services/clientPush.service.js',s=>s.replace("notification:{channelId:channel,...(sale?{icon:'ic_notification_money'}:{})}","notification:{channelId:channel,...(sale?{icon:'ic_notification_money'}:{}),...(sale&&agendamentoId?{tag:'saintsai-sale-'+String(agendamentoId)}:{})}"));

require('./commissions-v1');

require('./company-selection-v1');
