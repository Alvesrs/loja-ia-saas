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
 if(!s.includes(match)){console.warn('[manual-prospecting] old controller hook absent; retaining pre-existing routing');}
 if(s.includes(match))s=s.replace(match,"if (texto === GATILHO_VENDAS || texto === normalizarTextoVenda(require('../services/ownerSalesPrompt').INTRO)) {");
 const begin=s.indexOf('async function ativarConversaVenda(evento){');
 const end=s.indexOf('async function desativarConversaVenda(evento){',begin);
 if(begin<0||end<0){console.warn('[manual-prospecting] manual activation hook absent; no forced edit');}
 if(begin>=0&&end>=0)s=s.slice(0,begin)+`async function ativarConversaVenda(evento){
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

{
 const fs=require('node:fs'),cp=require('node:child_process');
 const p='src/controllers/whatsappWahaWebhook.controller.js';
 let c=fs.readFileSync(p,'utf8');
 const opening='  if (evento.fromMe === true) {';
 const close="  const chaveId={provedor:'waha',idExterno:evento.idExterno};";
 const a=c.indexOf(opening),z=c.indexOf(close,a);
 if(a<0||z<0)throw Error('Gatilho WAHA fromMe ausente; verificar webhook');
 const replacement=`  if (evento.fromMe === true) {
    try {
      // Mensagens enviadas pela API nao podem ativar ou pausar o agente.
      if(String(evento.source||'').toLowerCase()==='api')return res.status(200).json({status:'saida_api_ignorada'});
      const normal=t=>String(t||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\s+/g,' ').trim();
      const {INTRO}=require('../services/ownerSalesPrompt');
      const abordagem=normal(evento.texto)===normal(INTRO)||normal(evento.texto)===normal(GATILHO_VENDAS);
      const db=require('../config/supabase');
      const {data:configs,error:ce}=await db.from('whatsapp_configuracoes').select('id,loja_id').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(2);
      if(ce)throw ce;
      if(!configs||configs.length!==1)return res.status(200).json({status:'sessao_nao_unica'});
      const {data:loja,error:le}=await db.from('lojas').select('dono_id').eq('id',configs[0].loja_id).maybeSingle();
      if(le)throw le;
      if(!process.env.SAINTSAI_OWNER_USER_ID||loja?.dono_id!==process.env.SAINTSAI_OWNER_USER_ID)return res.status(200).json({status:'fora_da_loja_do_dono'});
      if(abordagem){
        const now=new Date().toISOString();
        const record={session_id:evento.destinatarioId,contato:evento.contato,loja_id:configs[0].loja_id,ativo:true,ultimo_evento_id:'prospeccao:iniciado:'+Date.now(),atualizado_em:now};
        const {error}=await db.from('saintsai_sales_conversations').upsert(record,{onConflict:'session_id,contato'});
        if(error)throw error;
        console.log('[waha.sales] ativado_por_abordagem_manual');
        return res.status(200).json({status:'ativado_por_abordagem_manual'});
      }
      // Qualquer outra mensagem manual pausa a conversa do vendedor, inclusive /parar.
      const {error}=await db.from('saintsai_sales_conversations').update({ativo:false,atualizado_em:new Date().toISOString()}).eq('session_id',evento.destinatarioId).eq('contato',evento.contato);
      if(error)throw error;
      console.log('[waha.sales] pausado_por_mensagem_manual');
      return res.status(200).json({status:'pausado_por_mensagem_manual'});
    }catch(err){
      console.error('[waha.sales] erro_controle_manual',err?.message||err);
      return res.status(500).json({erro:'Nao foi possivel atualizar o atendimento manual'});
    }
  }

`;
 c=c.slice(0,a)+replacement+c.slice(z);
 fs.writeFileSync(p,c);
 cp.execFileSync(process.execPath,['--check',p]);
 console.log('[manual-prospecting] qualquer contato, ativacao por abordagem, pausa por intervencao manual');
}

{
 const fs=require('node:fs'),cp=require('node:child_process');
 const file='src/routes/admin.routes.js';
 let s=fs.readFileSync(file,'utf8');
 const original="(process.env.GOOGLE_MAPS_API_KEY?require('../services/mapsProspecting.service'):require('../services/osmProspecting.service')).buscarProspeccao";
 const fallback="require('../services/prospeccaoFallback.service').buscarProspeccao";
 if(s.includes(original))s=s.replace(original,fallback);
 else if(!s.includes(fallback))throw Error('Busca de prospeccao nao localizada para aplicar fallback');
 fs.writeFileSync(file,s);
 const service=`const google=require('./mapsProspecting.service');
 const osm=require('./osmProspecting.service');
 async function buscarProspeccao(args){
  if(process.env.GOOGLE_MAPS_API_KEY){
   try {
    const result=await google.buscarProspeccao(args);
    if(Array.isArray(result.leads)&&result.leads.length)return result;
    const other=await osm.buscarProspeccao(args);
    return Array.isArray(other.leads)&&other.leads.length?{...other,aviso:'Busca complementar por contatos públicos. '+(other.aviso||'')}:result;
   }catch(error){
    if(error?.status===403||error?.status===400)throw error;
    console.warn('[prospeccao] maps_indisponivel_fallback_osm',error?.message||'indisponivel');
    try{return await osm.buscarProspeccao(args);}
    catch(second){console.error('[prospeccao] fallback_indisponivel',second?.message||'erro');throw Object.assign(new Error('As fontes de mapas estão temporariamente indisponíveis. Tente novamente em instantes.'),{status:503});}
   }
  }
  return osm.buscarProspeccao(args);
 }
 module.exports={buscarProspeccao};`;
 fs.writeFileSync('src/services/prospeccaoFallback.service.js',service);
 cp.execFileSync(process.execPath,['--check',file]);
 cp.execFileSync(process.execPath,['--check','src/services/prospeccaoFallback.service.js']);
 console.log('[prospeccao] fallback Google Maps -> OpenStreetMap habilitado');
}

{
const fs=require('node:fs'),cp=require('node:child_process');
let p='src/services/mapsProspecting.service.js',s=fs.readFileSync(p,'utf8');
const a=s.indexOf(' for(let i=0;i<candidatos.length&&leads.length<10;i+=4){'),b=s.indexOf(' if(unavailable)throw fail(',a);
if(a<0||b<0)throw Error('Google Maps leads routing not found');
const block=" for(let i=0;i<candidatos.length&&leads.length<10;i+=4){const batch=await Promise.all(candidatos.slice(i,i+4).map(async lead=>{try{await owner.chatPorTelefone(cfg[0].identificador_externo,lead.telefone);return {...lead,whatsapp_status:'Confirmado na conexão'};}catch(e){if(e.status!==400)unavailable=true;return {...lead,whatsapp_status:'Número público; WhatsApp não confirmado'};}}));leads.push(...batch.filter(Boolean));}\n";
s=s.slice(0,a)+block+s.slice(b);
s=s.replace("if(unavailable)throw fail('Não foi possível confirmar os WhatsApps agora. Confira a conexão por QR e tente novamente.');","if(unavailable)console.warn('[prospeccao] WhatsApp não confirmado; contatos públicos mantidos');");
s=s.replace('Até 10 contatos com WhatsApp confirmado, em ordem de potencial estimado por atividade e avaliações.','Até 10 telefones públicos de estabelecimentos, alguns sem WhatsApp confirmado.');
fs.writeFileSync(p,s);
p='src/services/osmProspecting.service.js';s=fs.readFileSync(p,'utf8');
s=s.replace("if(!session)return lead.whatsapp_publicado||lead.fonte?{...lead,whatsapp_status:'Publicado pela empresa'}:null;","if(!session)return {...lead,whatsapp_status:'Número público; WhatsApp não confirmado'};");
s=s.replace("if(e.status!==400){unavailable=true;if(lead.whatsapp_publicado||lead.fonte)return{...lead,whatsapp_status:'Publicado; confirmação indisponível agora'};}return null","if(e.status!==400)unavailable=true;return{...lead,whatsapp_status:'Número público; WhatsApp não confirmado'}");
fs.writeFileSync(p,s);
for(const file of ['src/services/mapsProspecting.service.js',p])cp.execFileSync(process.execPath,['--check',file]);
console.log('[prospeccao] telefones públicos preservados mesmo sem confirmação WAHA');
}
{const fs=require('node:fs'),cp=require('node:child_process');
let p='src/routes/admin.routes.js',s=fs.readFileSync(p,'utf8');
const anchor="router.post('/prospeccao/iniciar'";
if(!s.includes(anchor))throw Error('Status: route anchor missing');
if(!s.includes("router.get('/status-servicos'"))s=s.replace(anchor,"router.get('/status-servicos',exigirAdmin,async(req,res)=>{const db=require('../config/supabase');const checks=await Promise.all([db.from('lojas').select('id').limit(1),db.from('whatsapp_configuracoes').select('id').eq('ativo',true).limit(1)]);const banco=checks[0].error?'indisponivel':'operacional';const whatsapp=checks[1].error?'indisponivel':'degradado';res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),results:[{name:'Backend SaintsAI',status:'operacional',detail:'API respondeu à solicitação'},{name:'Supabase / Banco',status:banco,detail:banco==='operacional'?'Consulta ao banco concluída':'Consulta ao banco falhou'},{name:'WhatsApp / WAHA',status:whatsapp,detail:'Configuração não confirma envio real de mensagens'},{name:'Google Maps',status:process.env.GOOGLE_MAPS_API_KEY?'degradado':'indisponivel',detail:'Verificação de chave não comprova resultados da busca'},{name:'Asaas / Pix',status:process.env.ASAAS_API_KEY?'degradado':'indisponivel',detail:'Verificação de configuração não comprova cobranças'}],notice:'Amarelo significa configurado, mas operação não testada ao vivo.'});});\n"+anchor);
fs.writeFileSync(p,s);
fs.writeFileSync('public/admin-status.html',"<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Status · SaintsAI</title><style>body{background:#0c0813;color:#f5edff;font:16px system-ui;padding:20px}main{max-width:730px;margin:auto}a{color:#cda6ff}button{background:#823de0;color:white;border:0;padding:12px 18px;border-radius:10px;font-weight:700}article{background:#1f172c;margin:12px 0;padding:16px;border-radius:14px;border:1px solid #4b355c;display:flex;justify-content:space-between;gap:10px}.operacional{color:#6fe1a3}.degradado{color:#ffcf72}.indisponivel{color:#ff8a9b}small{color:#c8b9d4}</style></head><body><main><p><a href=\"admin-mobile.html\">← Voltar ao painel</a></p><h1>Status do SaintsAI</h1><p>Diagnóstico automático da infraestrutura, atualizado sob demanda.</p><button id=\"refresh\">↻ Atualizar status</button><p id=\"info\">Consultando...</p><div id=\"items\"></div><small>Configuração ativa não é garantia de que a busca, os pagamentos ou as mensagens estejam funcionando de ponta a ponta.</small></main><script src=\"js/api.js\"></script><script>const $=id=>document.getElementById(id);function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]))}async function load(){ $('info').textContent='Verificando...';try{const r=await apiFetch('/admin/status-servicos');$('items').innerHTML=(r.results||[]).map(x=>'<article><div><b>'+esc(x.name)+'</b><p><small>'+esc(x.detail)+'</small></p></div><strong class=\"'+esc(x.status)+'\">'+esc(x.status)+'</strong></article>').join('');$('info').textContent='Atualizado em '+new Date(r.checkedAt).toLocaleString('pt-BR')}catch(e){$('info').textContent='Falha ao consultar status: '+e.message}}$('refresh').onclick=load;load();</script></body></html>");
p='public/admin-mobile.html';s=fs.readFileSync(p,'utf8');
if(!s.includes('href="admin-status.html"'))s=s.replace('</body>',"<a href=\"admin-status.html\" style=\"position:fixed;bottom:14px;right:14px;z-index:99999;padding:12px 18px;border-radius:12px;background:#8439e7;color:white;text-decoration:none;font:bold 14px system-ui\">● Status</a></body>");
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check','src/routes/admin.routes.js']);
console.log('[status] painel de saúde adicionado');}

{
 const fs=require('node:fs'),cp=require('node:child_process');
 const route='src/app.js';let app=fs.readFileSync(route,'utf8');
 const call="require('./routes/saintsaiEntrega.routes')(app);";
 if(!app.includes(call))app=app.replace("require('./routes/galeria.routes')(app);","require('./routes/galeria.routes')(app);\n"+call);
 if(!app.includes(call))throw Error('Could not attach delivery route');
 fs.writeFileSync(route,app);
 const router=String.raw\`const express=require('express'),db=require('../config/supabase');
const {exigirLogin}=require('../middleware/auth');
const {exigirDonoDaLoja}=require('../middleware/lojaOwnership');
module.exports=app=>{
const r=express.Router({mergeParams:true});r.use(exigirLogin,exigirDonoDaLoja);r.use(express.json({limit:'16kb'}));
r.get('/',async(req,res)=>{try{const {data,error}=await db.from('saintsai_delivery_preferences').select('entrega_ativa,prazo_minutos,prazo_texto').eq('loja_id',req.params.lojaId).maybeSingle();if(error)throw error;res.json(data||{entrega_ativa:false,prazo_minutos:null,prazo_texto:null});}catch(e){console.error('[entrega] listar',e?.message);res.status(503).json({erro:'Não foi possível consultar entregas.'});}});
r.put('/',async(req,res)=>{try{const ativo=req.body?.entrega_ativa;if(typeof ativo!=='boolean')return res.status(400).json({erro:'Selecione Sim ou Não.'});const minutos=Number(req.body?.prazo_minutos);const prazo=String(req.body?.prazo_texto||'').trim().slice(0,160);if(ativo&&(!(Number.isInteger(minutos)&&minutos>=15&&minutos<=10080)||!prazo))return res.status(400).json({erro:'Informe um prazo válido para entregas.'});const {data,error}=await db.from('saintsai_delivery_preferences').upsert({loja_id:req.params.lojaId,entrega_ativa:ativo,prazo_minutos:ativo?minutos:null,prazo_texto:ativo?prazo:null,atualizado_em:new Date().toISOString()},{onConflict:'loja_id'}).select('entrega_ativa,prazo_minutos,prazo_texto').single();if(error)throw error;res.json(data);}catch(e){console.error('[entrega] salvar',e?.message);res.status(503).json({erro:'Não foi possível salvar as configurações de entrega.'});}});
app.use('/api/lojas/:lojaId/entrega-config',r);
};\`;
 fs.writeFileSync('src/routes/saintsaiEntrega.routes.js',router);
 const page=String.raw\`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entregas · SaintsAI</title><script src="js/guard.js"></script><style>body{background:#0e0a17;color:#f8f2ff;font:16px system-ui;margin:0;padding:20px}main{max-width:630px;margin:40px auto}.panel{background:#20142f;border:1px solid #49355c;padding:24px;border-radius:20px}a{color:#d0adff}label{display:block;margin:15px 0}input[type=radio]{width:20px;height:20px;accent-color:#9949ee}select,input[type=text]{width:100%;background:#130f1b;border:1px solid #64477b;color:#fff;border-radius:12px;padding:14px;box-sizing:border-box;font:inherit}button{border:0;background:#9343eb;color:white;border-radius:12px;padding:14px 20px;font-weight:700;font-size:16px;width:100%;margin-top:10px}p{line-height:1.5;color:#d7c9df}.choice{display:flex;gap:20px}.choice label{display:flex;align-items:center;gap:8px}#deadline[hidden]{display:none}#feedback{min-height:25px}</style></head><body><main><p><a href="cliente-central.html">← Voltar ao meu negócio</a></p><div class="panel"><h1>Entregas</h1><p>Ative apenas se o seu estabelecimento realiza entregas. O prazo será informado ao cliente antes de confirmar o pedido.</p><form id="delivery"><h2>Você trabalha com entregas?</h2><div class="choice"><label><input type="radio" name="active" value="yes"> Sim</label><label><input type="radio" name="active" value="no" checked> Não</label></div><section id="deadline" hidden><label for="minutes">Prazo estimado de entrega</label><select id="minutes"><option value="60">Até 1 hora</option><option value="120">Até 2 horas</option><option value="180">Até 3 horas</option><option value="240">Até 4 horas</option><option value="480">Até 8 horas</option><option value="1440">Até 24 horas</option><option value="10080">Até 7 dias</option></select><label for="custom">Mensagem sobre o prazo (opcional)</label><input id="custom" type="text" maxlength="160" placeholder="Ex.: Entregamos até o final do dia, após confirmação" /><p>O prazo é uma estimativa, não uma promessa de envio imediato. Confirme disponibilidade antes de cobrar.</p></section><button type="submit">Salvar configurações</button><p id="feedback" role="status"></p></form></div></main><script src="js/api.js"></script><script src="js/cliente-entregas.js"></script></body></html>\`;
 fs.writeFileSync('public/cliente-entregas.html',page);
 const js=String.raw\`(()=>{'use strict';let loja;const $=id=>document.getElementById(id),radios=[...document.querySelectorAll('input[name=active]')],active=()=>radios.find(x=>x.checked)?.value==='yes';function toggle(){$('deadline').hidden=!active()}radios.forEach(x=>x.onchange=toggle);async function load(){try{loja=await obterLojaAtual();if(!loja)throw Error('Selecione sua empresa no SaintsAI Cliente.');const d=await apiFetch('/lojas/'+loja.id+'/entrega-config');radios.find(x=>x.value===(d.entrega_ativa?'yes':'no')).checked=true;if(d.prazo_minutos)$('minutes').value=String(d.prazo_minutos);$('custom').value=d.prazo_texto||'';toggle();$('feedback').textContent='Configuração atual carregada.';}catch(e){$('feedback').textContent=e.message||'Não foi possível carregar.';}}$('delivery').onsubmit=async e=>{e.preventDefault();if(!loja)return;$('feedback').textContent='Salvando...';try{const minutes=Number($('minutes').value);const texto=$('custom').value.trim()||('Prazo estimado: até '+(minutes>=1440?minutes/1440+' dia(s)':minutes/60+' hora(s)')+' após confirmação do pedido.');await apiFetch('/lojas/'+loja.id+'/entrega-config',{method:'PUT',body:JSON.stringify({entrega_ativa:active(),prazo_minutos:minutes,prazo_texto:texto})});$('feedback').textContent='Configurações de entrega salvas.';}catch(e){$('feedback').textContent=e.message||'Falha ao salvar.';}};load()})();\`;
 fs.writeFileSync('public/js/cliente-entregas.js',js);
 const dash='src/services'; // insert into live dashboard JS shipped by prior patch
 const clientJS='public/js/cliente-dashboard-v2.js';let d=fs.readFileSync(clientJS,'utf8');
 if(!d.includes("'Entregas','cliente-entregas.html'"))d=d.replace("['gallery','Galeria','cliente-galeria.html']","['gallery','Galeria','cliente-galeria.html'],['box','Entregas','cliente-entregas.html']");
 fs.writeFileSync(clientJS,d);
 const main='public/cliente-central.html';let home=fs.readFileSync(main,'utf8');
 if(!home.includes('href="cliente-entregas.html"'))home=home.replace('</body>','<a href="cliente-entregas.html" style="position:fixed;bottom:18px;right:18px;z-index:800;background:#8e40ec;color:white;padding:13px 17px;border-radius:13px;text-decoration:none;font:bold 14px system-ui">🚚 Entregas</a></body>');
 fs.writeFileSync(main,home);
 for(const file of [route,'src/routes/saintsaiEntrega.routes.js','public/js/cliente-entregas.js'])cp.execFileSync(process.execPath,['--check',file]);
 console.log('[entregas] configuração da loja integrada ao SaintsAI Cliente');
}
