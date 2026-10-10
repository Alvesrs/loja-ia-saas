const fs=require('node:fs');
for(const [a,t] of [['owner-subscription-test','ownerSubscriptionTest'],['client-access-delivery','clientAccessDelivery'],['subscription-test-pricing','subscriptionTestPricing']])fs.copyFileSync('patches/assets/'+a+'.service.js','src/services/'+t+'.service.js');
fs.copyFileSync('patches/assets/cliente-acesso.html','public/cliente-acesso.html');
let p='src/services/ownerProductLab.service.js',s=fs.readFileSync(p,'utf8'),anchor=' const input=norm(args.pergunta),b=c.briefing||{};';if(!s.includes(anchor))throw Error('Missing lab anchor');s=s.replace(anchor,anchor+"\n const subscription=await require('./ownerSubscriptionTest.service').handle(args,c);if(subscription)return subscription;\n");fs.writeFileSync(p,s);
p='src/services/ownerSalesOnboarding.service.js';s=fs.readFileSync(p,'utf8');s=s.replace('module.exports={remember,','module.exports={access,paymentText,remember,');s=s.replace("const base=String(process.env.PUBLIC_BASE_URL||'').replace(/\\/$/,'');", "const base='https://backend-prod-production-f338.up.railway.app';");s=s.replace("'/cliente/login.html", "'/cliente-login.html");s=s.replace("Sua empresa e seu agente continuam na mesma conta.'", "Sua empresa e seu agente continuam na mesma conta.\\n'+require('./clientAccessDelivery.service').links()");s=s.replace("'Seu acesso já foi personalizado. Entre no SaintsAI Cliente com seu e-mail e senha pessoais.'", "'Seu acesso já foi personalizado. Entre com seu e-mail e senha pessoais.\\n'+require('./clientAccessDelivery.service').links()");fs.writeFileSync(p,s);
p='src/services/asaas.service.js';s=fs.readFileSync(p,'utf8');s+='\nrequire(\'./subscriptionTestPricing.service\');\nconst __originalProcessarEventoAsaas=module.exports.processarEventoAsaas;module.exports.processarEventoAsaas=async function(payload){const result=await __originalProcessarEventoAsaas(payload);try{await require(\'./clientAccessDelivery.service\').notify(payload);}catch(e){console.error(\'[subscription-access-delivery]\',e?.code||e?.name||\'Error\');}return result;};\n';fs.writeFileSync(p,s);
for(const name of ['cliente-login.html','comprar.html']){p='public/'+name;s=fs.readFileSync(p,'utf8');const link='<p style="text-align:center;margin:20px 0"><a href="cliente-acesso.html" style="color:#c99aff">Como acessar e baixar o aplicativo</a></p>';s=name==='cliente-login.html'?s.replace('</form>','</form>'+link):s.replace('</body>',link+'</body>');fs.writeFileSync(p,s);}
p='public/cliente-plano.html';s=fs.readFileSync(p,'utf8');s=s.replace('</body>',"<script>document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(true);});setInterval(()=>{if(document.visibilityState==='visible')load(true);},15000);</script></body>");fs.writeFileSync(p,s);
p='src/services/condicoesComerciais.service.js';s=fs.readFileSync(p,'utf8');s+=`
const __priceList=module.exports.listar,__pricePlan=module.exports.planoParaLoja;async function __centavoCustomer(id){return typeof process!=='undefined'&&Boolean(process.env.SAINTSAI_OWNER_USER_ID)&&await require('./subscriptionTestPricing.service').enabled(id);}module.exports.listar=async id=>{const list=await __priceList(id);return await __centavoCustomer(id)?list.map(p=>p.vendavel?{...p,precoMensalCentavos:require('./subscriptionTestPricing.service').price(p.codigo),precoPersonalizado:true}:p):list;};module.exports.planoParaLoja=async(id,code)=>{const p=await __pricePlan(id,code);return p?.vendavel&&await __centavoCustomer(id)?{...p,precoMensalCentavos:require('./subscriptionTestPricing.service').price(p.codigo),precoPersonalizado:true}:p;};
`;fs.writeFileSync(p,s);
console.log('Owner centavo subscription test and customer access delivery installed.');


// Autoriza continuação após abordagem enviada MANUALMENTE pelo próprio dono.
{
 const p='src/controllers/whatsappWahaWebhook.controller.js';
 let s=fs.readFileSync(p,'utf8');
 const match='if (texto === GATILHO_VENDAS) {';
 if(!s.includes(match))throw Error('Gatilho manual da prospeccao nao encontrado');
 s=s.replace(match,"if (texto === GATILHO_VENDAS || texto === normalizarTextoVenda(require('../services/ownerSalesPrompt').INTRO)) {");
 const begin=s.indexOf('async function ativarConversaVenda(evento){');
 const end=s.indexOf('async function desativarConversaVenda(evento){',begin);
 if(begin<0||end<0)throw Error('Ativacao manual sem ancora');
 s=s.slice(0,begin)+`async function ativarConversaVenda(evento){
 const {data:cfg,error:ec}=await supabase.from('whatsapp_configuracoes').select('id,loja_id,identificador_externo').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(2);
 if(ec)throw ec;
 if(!cfg||cfg.length!==1)return;
 const {data:loja,error:el}=await supabase.from('lojas').select('dono_id').eq('id',cfg[0].loja_id).maybeSingle();
 if(el)throw el;
 if(!process.env.SAINTSAI_OWNER_USER_ID||loja?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return;
 const agora=new Date().toISOString();
 const payload={session_id:evento.destinatarioId,contato:evento.contato,loja_id:cfg[0].loja_id,configuracao_id:cfg[0].id,ativo:true,atualizado_em:agora,ultimo_evento_id:'prospeccao:iniciado:'+Date.now()};
 const {error}=await supabase.from('saintsai_sales_conversations').upsert(payload,{onConflict:'session_id,contato'});
 if(error)throw error;
 console.log('[waha.sales] abordagem_manual_ativada');
}

`+s.slice(end);
 fs.writeFileSync(p,s);
 require('node:child_process').execFileSync(process.execPath,['--check',p]);
 console.log('[manual-prospecting] abordagem atual e antiga ativam atendimento sem envio automatizado');
}
