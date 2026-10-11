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
 const router=String.raw`const express=require('express'),db=require('../config/supabase');
const {exigirLogin}=require('../middleware/auth');
const {exigirDonoDaLoja}=require('../middleware/lojaOwnership');
module.exports=app=>{
const r=express.Router({mergeParams:true});r.use(exigirLogin,exigirDonoDaLoja);r.use(express.json({limit:'16kb'}));
r.get('/',async(req,res)=>{try{const {data,error}=await db.from('saintsai_delivery_preferences').select('entrega_ativa,prazo_minutos,prazo_texto').eq('loja_id',req.params.lojaId).maybeSingle();if(error)throw error;res.json(data||{entrega_ativa:false,prazo_minutos:null,prazo_texto:null});}catch(e){console.error('[entrega] listar',e?.message);res.status(503).json({erro:'Não foi possível consultar entregas.'});}});
r.put('/',async(req,res)=>{try{const ativo=req.body?.entrega_ativa;if(typeof ativo!=='boolean')return res.status(400).json({erro:'Selecione Sim ou Não.'});const minutos=Number(req.body?.prazo_minutos);const prazo=String(req.body?.prazo_texto||'').trim().slice(0,160);if(ativo&&(!(Number.isInteger(minutos)&&minutos>=15&&minutos<=10080)||!prazo))return res.status(400).json({erro:'Informe um prazo válido para entregas.'});const {data,error}=await db.from('saintsai_delivery_preferences').upsert({loja_id:req.params.lojaId,entrega_ativa:ativo,prazo_minutos:ativo?minutos:null,prazo_texto:ativo?prazo:null,atualizado_em:new Date().toISOString()},{onConflict:'loja_id'}).select('entrega_ativa,prazo_minutos,prazo_texto').single();if(error)throw error;res.json(data);}catch(e){console.error('[entrega] salvar',e?.message);res.status(503).json({erro:'Não foi possível salvar as configurações de entrega.'});}});
app.use('/api/lojas/:lojaId/entrega-config',r);
};`;
 fs.writeFileSync('src/routes/saintsaiEntrega.routes.js',router);
 const page=String.raw`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entregas · SaintsAI</title><script src="js/guard.js"></script><style>body{background:#0e0a17;color:#f8f2ff;font:16px system-ui;margin:0;padding:20px}main{max-width:630px;margin:40px auto}.panel{background:#20142f;border:1px solid #49355c;padding:24px;border-radius:20px}a{color:#d0adff}label{display:block;margin:15px 0}input[type=radio]{width:20px;height:20px;accent-color:#9949ee}select,input[type=text]{width:100%;background:#130f1b;border:1px solid #64477b;color:#fff;border-radius:12px;padding:14px;box-sizing:border-box;font:inherit}button{border:0;background:#9343eb;color:white;border-radius:12px;padding:14px 20px;font-weight:700;font-size:16px;width:100%;margin-top:10px}p{line-height:1.5;color:#d7c9df}.choice{display:flex;gap:20px}.choice label{display:flex;align-items:center;gap:8px}#deadline[hidden]{display:none}#feedback{min-height:25px}</style></head><body><main><p><a href="cliente-central.html">← Voltar ao meu negócio</a></p><div class="panel"><h1>Entregas</h1><p>Ative apenas se o seu estabelecimento realiza entregas. O prazo será informado ao cliente antes de confirmar o pedido.</p><form id="delivery"><h2>Você trabalha com entregas?</h2><div class="choice"><label><input type="radio" name="active" value="yes"> Sim</label><label><input type="radio" name="active" value="no" checked> Não</label></div><section id="deadline" hidden><label for="minutes">Prazo estimado de entrega</label><select id="minutes"><option value="60">Até 1 hora</option><option value="120">Até 2 horas</option><option value="180">Até 3 horas</option><option value="240">Até 4 horas</option><option value="480">Até 8 horas</option><option value="1440">Até 24 horas</option><option value="10080">Até 7 dias</option></select><label for="custom">Mensagem sobre o prazo (opcional)</label><input id="custom" type="text" maxlength="160" placeholder="Ex.: Entregamos até o final do dia, após confirmação" /><p>O prazo é uma estimativa, não uma promessa de envio imediato. Confirme disponibilidade antes de cobrar.</p></section><button type="submit">Salvar configurações</button><p id="feedback" role="status"></p></form></div></main><script src="js/api.js"></script><script src="js/cliente-entregas.js"></script></body></html>`;
 fs.writeFileSync('public/cliente-entregas.html',page);
 const js=String.raw`(()=>{'use strict';let loja;const $=id=>document.getElementById(id),radios=[...document.querySelectorAll('input[name=active]')],active=()=>radios.find(x=>x.checked)?.value==='yes';function toggle(){$('deadline').hidden=!active()}radios.forEach(x=>x.onchange=toggle);async function load(){try{loja=await obterLojaAtual();if(!loja)throw Error('Selecione sua empresa no SaintsAI Cliente.');const d=await apiFetch('/lojas/'+loja.id+'/entrega-config');radios.find(x=>x.value===(d.entrega_ativa?'yes':'no')).checked=true;if(d.prazo_minutos)$('minutes').value=String(d.prazo_minutos);$('custom').value=d.prazo_texto||'';toggle();$('feedback').textContent='Configuração atual carregada.';}catch(e){$('feedback').textContent=e.message||'Não foi possível carregar.';}}$('delivery').onsubmit=async e=>{e.preventDefault();if(!loja)return;$('feedback').textContent='Salvando...';try{const minutes=Number($('minutes').value);const texto=$('custom').value.trim()||('Prazo estimado: até '+(minutes>=1440?minutes/1440+' dia(s)':minutes/60+' hora(s)')+' após confirmação do pedido.');await apiFetch('/lojas/'+loja.id+'/entrega-config',{method:'PUT',body:JSON.stringify({entrega_ativa:active(),prazo_minutos:minutes,prazo_texto:texto})});$('feedback').textContent='Configurações de entrega salvas.';}catch(e){$('feedback').textContent=e.message||'Falha ao salvar.';}};load()})();`;
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


{
const fs=require('node:fs'),cp=require('node:child_process');
const route='src/routes/saintsaiEntrega.routes.js';let src=fs.readFileSync(route,'utf8');
const anchor="app.use('/api/lojas/:lojaId/entrega-config',r);";
if(!src.includes(anchor))throw Error('Delivery route hook missing');
const api=[
"r.get('/pedidos',async(req,res)=>{try{const {data,error}=await db.from('saintsai_delivery_orders').select('*').eq('loja_id',req.params.lojaId).order('criado_em',{ascending:false}).limit(200);if(error)throw error;res.json({pedidos:data||[]});}catch(e){res.status(503).json({erro:'Falha ao carregar entregas.'});}});",
"r.post('/pedidos',async(req,res)=>{try{const x=req.body||{},m=x.modalidade==='retirada'?'retirada':'entrega',contato=String(x.contato||'').slice(0,80),itens=String(x.itens_resumo||'').slice(0,700),endereco=String(x.endereco||'').slice(0,400);if(!contato||!itens||(m==='entrega'&&!endereco))return res.status(400).json({erro:'Informe contato, itens e endereço.'});const cfg=await db.from('saintsai_delivery_preferences').select('*').eq('loja_id',req.params.lojaId).maybeSingle();if(cfg.error)throw cfg.error;if(m==='entrega'&&!cfg.data?.entrega_ativa)return res.status(409).json({erro:'Entregas desativadas.'});const valor=x.valor_centavos==null?null:Number(x.valor_centavos);if(valor!==null&&(!Number.isInteger(valor)||valor<0))return res.status(400).json({erro:'Valor inválido.'});const {data,error}=await db.from('saintsai_delivery_orders').insert({loja_id:req.params.lojaId,contato,cliente_nome:String(x.cliente_nome||'').slice(0,120),itens_resumo:itens,valor_centavos:valor,modalidade:m,endereco:m==='entrega'?endereco:null,prazo_minutos:m==='entrega'?cfg.data.prazo_minutos:null,pagamento_status:m==='retirada'?'nao_aplicavel':'pendente',status:'aguardando_pagamento'}).select('*').single();if(error)throw error;res.status(201).json(data);}catch(e){console.error('[entrega] registrar',e.message);res.status(503).json({erro:'Falha ao registrar pedido.'});}});",
"r.patch('/pedidos/:id',async(req,res)=>{try{const status=String(req.body?.status||'');if(!['preparando','em_rota','entregue','cancelado'].includes(status))return res.status(400).json({erro:'Status inválido.'});const old=await db.from('saintsai_delivery_orders').select('status,pagamento_status,modalidade').eq('loja_id',req.params.lojaId).eq('id',req.params.id).maybeSingle();if(old.error)throw old.error;if(!old.data)return res.status(404).json({erro:'Pedido não encontrado.'});if(old.data.modalidade==='entrega'&&old.data.pagamento_status!=='confirmado'&&status!=='cancelado')return res.status(409).json({erro:'Entrega bloqueada: pagamento ainda não confirmado.'});if(['entregue','cancelado'].includes(old.data.status))return res.status(409).json({erro:'Pedido encerrado.'});const {data,error}=await db.from('saintsai_delivery_orders').update({status,atualizado_em:new Date().toISOString()}).eq('loja_id',req.params.lojaId).eq('id',req.params.id).eq('status',old.data.status).select('*').maybeSingle();if(error)throw error;res.json(data||{atualizado:false});}catch(e){res.status(503).json({erro:'Falha ao atualizar.'});}});"
].join('\n');
src=src.replace(anchor,api+'\n'+anchor);fs.writeFileSync(route,src);
const file='public/cliente-entregas.html';let html=fs.readFileSync(file,'utf8');
const ui='<section class="panel" style="margin-top:20px"><h2>Pedidos e mapa</h2><form id="order-form"><label>Contato<input id="order-contact" required type="text"></label><label>Cliente<input id="order-name" type="text"></label><label>Itens<input id="order-items" required type="text"></label><label>Modalidade<select id="order-type"><option value="entrega">Entrega</option><option value="retirada">Retirada na loja</option></select></label><label>Endereço completo<input id="order-address" type="text"></label><label>Valor R$<input id="order-value" inputmode="decimal" type="text"></label><button type="submit">Registrar pedido</button></form><p id="order-feedback"></p><button id="order-refresh" type="button">Atualizar pedidos</button><div id="order-list"></div><iframe id="order-map" title="Mapa da entrega" loading="lazy" style="display:none;width:100%;height:320px;border:0;border-radius:12px"></iframe></section>';
html=html.replace('</main>',ui+'</main>').replace('</body>','<script src="js/cliente-pedidos-entrega.js"></script></body>');fs.writeFileSync(file,html);
const js="(()=>{'use strict';const g=id=>document.getElementById(id);let loja;async function store(){if(!loja)loja=await obterLojaAtual();if(!loja)throw Error('Selecione sua empresa.');return loja;}async function load(){try{const l=await store(),r=await apiFetch('/lojas/'+l.id+'/entrega-config/pedidos');const node=g('order-list');node.replaceChildren();for(const x of r.pedidos||[]){const card=document.createElement('article');card.style.cssText='padding:12px;background:#140b22;border-radius:12px;margin:10px 0';const info=document.createElement('p');info.textContent=(x.cliente_nome||x.contato)+' · '+x.itens_resumo+' · '+(x.endereco||'Retirada')+' · '+x.status+' · pagamento '+x.pagamento_status;card.append(info);if(x.endereco){const b=document.createElement('button');b.textContent='Ver endereço no mapa';b.onclick=()=>{const m=g('order-map');m.src='https://maps.google.com/maps?q='+encodeURIComponent(x.endereco)+'&output=embed';m.style.display='block';};card.append(b);}if(x.pagamento_status==='confirmado'&&!['entregue','cancelado'].includes(x.status)){const b=document.createElement('button');b.textContent='Avançar etapa';b.onclick=async()=>{const next=x.status==='em_rota'?'entregue':x.status==='preparando'?'em_rota':'preparando';try{await apiFetch('/lojas/'+l.id+'/entrega-config/pedidos/'+x.id,{method:'PATCH',body:JSON.stringify({status:next})});load();}catch(e){g('order-feedback').textContent=e.message}};card.append(b);}node.append(card);}}catch(e){g('order-feedback').textContent=e.message;}}g('order-refresh').onclick=load;g('order-form').onsubmit=async e=>{e.preventDefault();try{const l=await store(),raw=g('order-value').value.replace(',','.').trim(),value=raw?Math.round(Number(raw)*100):null;await apiFetch('/lojas/'+l.id+'/entrega-config/pedidos',{method:'POST',body:JSON.stringify({contato:g('order-contact').value,cliente_nome:g('order-name').value,itens_resumo:g('order-items').value,modalidade:g('order-type').value,endereco:g('order-address').value,valor_centavos:value})});g('order-feedback').textContent='Pedido registrado; entrega aguarda confirmação de pagamento.';g('order-form').reset();await load();}catch(e){g('order-feedback').textContent=e.message}};load()})();";
fs.writeFileSync('public/js/cliente-pedidos-entrega.js',js);
for(const p of [route,'public/js/cliente-pedidos-entrega.js'])cp.execFileSync(process.execPath,['--check',p]);console.log('[entregas] painel pedidos e mapa criado');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const service=[
"const db=require('../config/supabase');",
"const norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();",
"const answer=resposta=>({resposta});",
"async function tentar(m){const {lojaId,contato}=m,texto=String(m.texto||'').trim(),t=norm(texto);if(!contato||!texto)return null;",
"const {data:cfg,error:ce}=await db.from('saintsai_delivery_preferences').select('entrega_ativa,prazo_texto,prazo_minutos').eq('loja_id',lojaId).maybeSingle();if(ce)throw ce;if(!cfg?.entrega_ativa)return null;",
"const {data:session,error:se}=await db.from('saintsai_delivery_sessions').select('*').eq('loja_id',lojaId).eq('contato',contato).maybeSingle();if(se)throw se;",
"const start=/\\b(quero entrega|entregar em casa|receber em casa|delivery|fazer entrega|pedido para entrega)\\b/.test(t);",
"if(!session&&!start)return null;",
"const save=async fields=>{const {error}=await db.from('saintsai_delivery_sessions').upsert({loja_id:lojaId,contato,...(session||{}),...fields,atualizado_em:new Date().toISOString()},{onConflict:'loja_id,contato'});if(error)throw error;};",
"if(/^(cancelar pedido|cancelar entrega|parar entrega)$/.test(t)){await db.from('saintsai_delivery_sessions').delete().eq('loja_id',lojaId).eq('contato',contato);return answer('Tudo bem, encerrei o cadastro da entrega.');}",
"if(!session||start){await save({fase:'itens',itens_resumo:null,endereco:null,modalidade:'entrega'});return answer('Trabalhamos com entregas. '+(cfg.prazo_texto||'Prazo estimado de '+cfg.prazo_minutos+' minutos após a confirmação do pedido.')+' O que você deseja pedir?');}",
"if(session.fase==='itens'){if(texto.length<3)return answer('Diga quais produtos ou serviços deseja receber.');await save({fase:'endereco',itens_resumo:texto});return answer('Certo! Envie seu endereço completo com rua, número, bairro, cidade e estado.');}",
"if(session.fase==='endereco'){if(texto.length<12)return answer('Preciso do endereço completo: rua, número, bairro, cidade e estado.');await save({fase:'confirmar',endereco:texto});return answer('Confirma este pedido para entrega? Itens: '+session.itens_resumo+'. Endereço: '+texto+'. '+(cfg.prazo_texto||'Prazo estimado informado pela loja.')+' Responda SIM para registrar ou CANCELAR ENTREGA. O pedido ainda não está pago.');}",
"if(session.fase==='confirmar'){if(!/^(sim|confirmo|confirmar)$/.test(t))return answer('Responda SIM para registrar ou CANCELAR ENTREGA.');const {data,error}=await db.from('saintsai_delivery_orders').insert({loja_id:lojaId,contato,itens_resumo:session.itens_resumo,endereco:session.endereco,modalidade:'entrega',prazo_minutos:cfg.prazo_minutos,status:'aguardando_pagamento',pagamento_status:'pendente'}).select('id').single();if(error)throw error;await db.from('saintsai_delivery_sessions').delete().eq('loja_id',lojaId).eq('contato',contato);return answer('Pedido registrado sob referência '+data.id.slice(0,8)+'. A loja vai conferir disponibilidade, frete e valor final antes de cobrar. A entrega só será liberada após confirmação real do pagamento.');}",
"return null;}",
"module.exports={tentar};"
].join('\n');
fs.writeFileSync('src/services/entregaWhatsapp.service.js',service);
const path='src/services/whatsappAtendente.service.js';let s=fs.readFileSync(path,'utf8');
const anchor='  const respostaAgenda = vendaAtiva ? null : await agendaWhatsapp.tentarResponder(mensagem);';
if(!s.includes(anchor))throw Error('Delivery WhatsApp hook not found');
s=s.replace(anchor,"  if(!vendaAtiva){const entrega=await require('./entregaWhatsapp.service').tentar(mensagem);if(entrega)return Object.freeze({lojaId,contato,idExterno,pergunta:texto,...entrega});}\n"+anchor);
fs.writeFileSync(path,s);
for(const file of ['src/services/entregaWhatsapp.service.js',path])cp.execFileSync(process.execPath,['--check',file]);
console.log('[entrega] fluxo de endereço no WhatsApp integrado sem confirmar pagamento');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const content=[
"const db=require('../config/supabase'),sub=require('./asaasSubconta.service');",
"const {timingSafeEqual}=require('node:crypto');",
"const safe=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};",
"const ref=(loja,id)=>'saintsai_entrega:'+loja+':'+id;",
"async function gerar(loja,id){const q=await db.from('saintsai_delivery_orders').select('*').eq('loja_id',loja).eq('id',id).maybeSingle();if(q.error)throw q.error;const row=q.data;if(!row)throw Error('pedido_nao_encontrado');if(row.modalidade!=='entrega')throw Error('somente_entrega');if(row.pagamento_status==='confirmado')return {status:'pago'};if(!Number.isInteger(row.valor_centavos)||row.valor_centavos<100)throw Error('valor_final_nao_definido');if(row.pagamento_referencia)throw Error('pix_ja_gerado');const api=await sub.obterApiKeyLoja(loja);const keys=await sub.req('/v3/pix/addressKeys?status=ACTIVE&limit=20',{method:'GET'},api),key=(keys.data||[]).find(x=>x.status==='ACTIVE'&&x.key)?.key;if(!key)throw Error('chave_pix_ativa_ausente');const pix=await sub.req('/v3/pix/qrCodes/static',{method:'POST',body:{addressKey:key,description:'SaintsAI entrega',value:row.valor_centavos/100,format:'ALL',expirationSeconds:3600,allowsMultiplePayments:false,externalReference:ref(loja,id)}},api);if(!pix.id||!pix.payload)throw Error('pix_invalido');const result=await db.from('saintsai_delivery_orders').update({pagamento_referencia:pix.id,atualizado_em:new Date().toISOString()}).eq('loja_id',loja).eq('id',id).is('pagamento_referencia',null).select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)throw Error('pix_concorrente');return {status:'aguardando_pagamento',pix_copia_cola:pix.payload,valor_centavos:row.valor_centavos};}",
"async function webhook(payload,token){const p=payload?.payment||{},reference=String(p.externalReference||''),m=/^saintsai_entrega:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(reference);if(!m)return false;const [_,loja,id]=m;if(!safe(token,sub.tokenWebhook(loja)))throw Error('webhook_nao_autorizado');const order=await db.from('saintsai_delivery_orders').select('*').eq('loja_id',loja).eq('id',id).maybeSingle();if(order.error)throw order.error;const row=order.data;if(!row)return true;if(row.pagamento_referencia&&p.pixQrCodeId&&row.pagamento_referencia!==p.pixQrCodeId)throw Error('pix_reference_mismatch');if(!['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(payload.event))return true;if(!row.pagamento_referencia||!p.pixQrCodeId||row.pagamento_referencia!==p.pixQrCodeId)return true;const result=await db.from('saintsai_delivery_orders').update({pagamento_status:'confirmado',status:row.status==='aguardando_pagamento'?'confirmado':row.status,atualizado_em:new Date().toISOString()}).eq('loja_id',loja).eq('id',id).eq('pagamento_referencia',p.pixQrCodeId).neq('status','cancelado');if(result.error)throw result.error;console.log('[entrega] pagamento_confirmado');return true;}",
"module.exports={gerar,webhook};"
].join('\n');
fs.writeFileSync('src/services/entregaPix.service.js',content);
let file='src/routes/saintsaiEntrega.routes.js',r=fs.readFileSync(file,'utf8'),anchor="r.get('/pedidos',async(req,res)=>";
if(!r.includes(anchor))throw Error('delivery Pix route insertion anchor missing');
const endpoint="r.post('/pedidos/:id/pix',async(req,res)=>{try{const out=await require('../services/entregaPix.service').gerar(req.params.lojaId,req.params.id);res.json(out);}catch(e){console.error('[entrega] pix',e?.message);res.status(409).json({erro:'Não foi possível emitir Pix: '+String(e?.message||'indisponível')});}});\n";
r=r.replace(anchor,endpoint+anchor);fs.writeFileSync(file,r);
file='src/controllers/asaasSubcontaWebhook.controller.js';let w=fs.readFileSync(file,'utf8'),wanchor="async function webhook(req,res){try{";
if(!w.includes(wanchor))throw Error('Asaas webhook anchor missing');
w=w.replace(wanchor,wanchor+"const handled=await require('../services/entregaPix.service').webhook(req.body||{},req.get('asaas-access-token'));if(handled)return res.status(200).json({ok:true,entrega:true});");
fs.writeFileSync(file,w);
file='public/js/cliente-pedidos-entrega.js';let ui=fs.readFileSync(file,'utf8');const uiAnchor="if(x.pagamento_status==='confirmado'";
if(!ui.includes(uiAnchor))throw Error('Pix UI anchor missing');
const action="if(x.modalidade==='entrega'&&x.pagamento_status!=='confirmado'){const b=document.createElement('button');b.textContent='Gerar Pix Asaas';b.onclick=async()=>{try{const v=await apiFetch('/lojas/'+l.id+'/entrega-config/pedidos/'+x.id+'/pix',{method:'POST',body:'{}'});if(v.pix_copia_cola){const box=document.createElement('textarea');box.value=v.pix_copia_cola;box.readOnly=true;box.style.cssText='width:100%;height:120px';card.append(box);g('order-feedback').textContent='Pix emitido. Envie a cobrança ao cliente e aguarde a confirmação do Asaas.'}}catch(err){g('order-feedback').textContent=err.message;}};card.append(b);} ";
ui=ui.replace(uiAnchor,action+uiAnchor);fs.writeFileSync(file,ui);
for(const p of ['src/services/entregaPix.service.js','src/routes/saintsaiEntrega.routes.js','src/controllers/asaasSubcontaWebhook.controller.js',file])cp.execFileSync(process.execPath,['--check',p]);console.log('[entrega] Pix Asaas para entregas com confirmação webhook autenticada');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const file='src/services/entregaWhatsapp.service.js';let s=fs.readFileSync(file,'utf8');
const match="const start=/\\b(quero entrega|entregar em casa|receber em casa|delivery|fazer entrega|pedido para entrega)\\b/.test(t);";
if(!s.includes(match))throw Error('Delivery choice hook missing');
s=s.replace(match,"const retirada=/\\b(quero retirar|retirar na loja|buscar na loja|pegar na loja)\\b/.test(t);const start=retirada||/\\b(quero entrega|entregar em casa|receber em casa|delivery|fazer entrega|pedido para entrega)\\b/.test(t);");
s=s.replace("await save({fase:'itens',itens_resumo:null,endereco:null,modalidade:'entrega'});return answer('Trabalhamos com entregas. '","await save({fase:'itens',itens_resumo:null,endereco:null,modalidade:retirada?'retirada':'entrega'});return answer(retirada?'Você pode retirar na loja. Qual é o seu pedido? ':'Trabalhamos com entregas. '");
s=s.replace("await save({fase:'endereco',itens_resumo:texto});return answer('Certo! Envie seu endereço completo com rua, número, bairro, cidade e estado.');","await save({fase:session.modalidade==='retirada'?'confirmar':'endereco',itens_resumo:texto});return answer(session.modalidade==='retirada'?'Confirma retirada na loja dos itens: '+texto+'? Responda SIM para registrar. O pagamento será feito na loja.':'Certo! Envie seu endereço completo com rua, número, bairro, cidade e estado.');");
s=s.replace("endereco:session.endereco,modalidade:'entrega',prazo_minutos:cfg.prazo_minutos,status:'aguardando_pagamento',pagamento_status:'pendente'","endereco:session.modalidade==='retirada'?null:session.endereco,modalidade:session.modalidade||'entrega',prazo_minutos:session.modalidade==='retirada'?null:cfg.prazo_minutos,status:'aguardando_pagamento',pagamento_status:session.modalidade==='retirada'?'nao_aplicavel':'pendente'");
s=s.replace("return answer('Pedido registrado sob referência '+data.id.slice(0,8)+'. A loja vai conferir disponibilidade, frete e valor final antes de cobrar. A entrega só será liberada após confirmação real do pagamento.');","return answer(session.modalidade==='retirada'?'Retirada solicitada sob referência '+data.id.slice(0,8)+'. A loja confirmará disponibilidade e horário de retirada. O pagamento será feito na loja.':'Pedido registrado sob referência '+data.id.slice(0,8)+'. A loja vai conferir disponibilidade, frete e valor final antes de cobrar. A entrega só será liberada após confirmação real do pagamento.');");
fs.writeFileSync(file,s);cp.execFileSync(process.execPath,['--check',file]);console.log('[entrega] modo retirada com pagamento na loja adicionado');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const file='src/services/entregaWhatsapp.service.js';let s=fs.readFileSync(file,'utf8');
const anchor="const answer=resposta=>({resposta});";
const fn=[
"async function precificar(lojaId,descricao){",
" const {data,error}=await db.from('produtos').select('nome,preco,ativo').eq('loja_id',lojaId).eq('ativo',true).limit(1000);if(error)throw error;",
" const text=norm(descricao),matches=[];for(const p of data||[]){const name=norm(p.nome),price=Number(p.preco);if(!name||!Number.isFinite(price)||price<0)continue;const escaped=name.replace(/[.*+?^$()|[\\]{}]/g,'\\$&');",
" const pattern=new RegExp('(?:^|[,;\\n ]+)(?:(\\d{1,3})\\s*(?:x|unidades? de|un\\.? de)?\\s*)?'+escaped+'(?=$|[,;\\n ]+)','i');const m=pattern.exec(text);if(m)matches.push({nome:p.nome,quantidade:Math.max(1,Number(m[1]||1)),centavos:Math.round(price*100)});}",
" const unique=[...new Map(matches.map(x=>[norm(x.nome),x])).values()];if(unique.length!==1)return null;",
" const item=unique[0];const rest=text.replace(norm(item.nome),'').replace(/\\b(\\d+|x|unidades?|de|quero|comprar|pedido|por favor|uma?|dois|duas)\\b/g,'').replace(/[^a-z0-9]/g,'');",
" if(rest)return null;return {valor_centavos:item.centavos*item.quantidade,resumo:item.quantidade+'x '+item.nome};",
"}"
].join('\n');
if(!s.includes(anchor))throw Error('Pricing hook absent');
s=s.replace(anchor,anchor+'\n'+fn);
const lookup="const {data,error}=await db.from('saintsai_delivery_orders').insert({loja_id:lojaId,contato,itens_resumo:session.itens_resumo,";
if(!s.includes(lookup))throw Error('Order pricing insertion missing');
s=s.replace(lookup,"const preco=await precificar(lojaId,session.itens_resumo);const {data,error}=await db.from('saintsai_delivery_orders').insert({loja_id:lojaId,contato,itens_resumo:preco?.resumo||session.itens_resumo,valor_centavos:preco?.valor_centavos??null,");
const phrase="A loja vai conferir disponibilidade, frete e valor final antes de cobrar.";
s=s.replace(phrase,"'+(preco?'Preço do item no catálogo: R$ '+(preco.valor_centavos/100).toFixed(2).replace('.',',')+'. Frete e disponibilidade ainda precisam ser conferidos.':'A loja vai conferir os preços, disponibilidade e frete antes de cobrar.')+'");
fs.writeFileSync(file,s);
const page='public/cliente-entregas.html';let h=fs.readFileSync(page,'utf8');const a=h.indexOf('<form id="order-form">'),b=h.indexOf('</form>',a);
if(a<0||b<0)throw Error('Manual delivery form missing');
h=h.slice(0,a)+'<p>Os pedidos são registrados automaticamente pelo agente durante o atendimento pelo WhatsApp. Confira os dados, o valor e o pagamento antes de liberar uma entrega.</p>'+h.slice(b+7);
fs.writeFileSync(page,h);
const ui='public/js/cliente-pedidos-entrega.js';let u=fs.readFileSync(ui,'utf8');const x=u.indexOf("g('order-form').onsubmit="),y=u.indexOf(';load()})();',x);
if(x<0||y<0)throw Error('Manual order JS handler missing');
u=u.slice(0,x)+u.slice(y+1);fs.writeFileSync(ui,u);
for(const f of [file,ui])cp.execFileSync(process.execPath,['--check',f]);
console.log('[entrega] pedidos automaticos, valor catalogo quando inequívoco, formulario manual removido');
}

{const fs=require('node:fs'),cp=require('node:child_process');
fs.writeFileSync('src/routes/radarInteresse.routes.js',"const express=require('express');\nconst {exigirLogin}=require('../middleware/auth');\nconst {exigirDonoDaLoja}=require('../middleware/lojaOwnership');\nconst router=express.Router();\nconst TERMS=['automatizar whatsapp empresa','atendimento whatsapp automático','preciso chatbot whatsapp','automatizar agendamento whatsapp','looking for whatsapp chatbot','need whatsapp automation','whatsapp booking automation'];\nconst signal=/\\\\b(preciso|procurando|alguem (indica|recomenda)|contratar|necessito|queria|busco|need|looking for|recommend|hire|seeking|searching for|how can i|como (posso|faco))\\\\b/i;\nconst relevance=/whatsapp|chatbot|atendimento automat|agendamento automat|customer support autom|booking autom/i;\nconst seller=/\\\\b(vendo|ofereco|agencia de|nossa solucao|our service|we offer|for hire|hiring developers)\\\\b/i;\nfunction clean(v){return String(v||'').replace(/<[^>]*>/g,' ').replace(/&quot;/g,'\"').replace(/&#x27;|&#39;/g,\"'\").replace(/&amp;/g,'&').replace(/\\\\s+/g,' ').trim().slice(0,900)}\nasync function fetchTerm(term){const u=new URL('https://hn.algolia.com/api/v1/search_by_date');u.searchParams.set('query',term);u.searchParams.set('tags','story');u.searchParams.set('hitsPerPage','30');u.searchParams.set('numericFilters','created_at_i>'+Math.floor(Date.now()/1000-30*86400));const response=await fetch(u,{signal:AbortSignal.timeout(8500)});if(!response.ok)throw Error('Fonte indisponível: '+response.status);return (await response.json()).hits||[]}\nrouter.get('/sinais-publicos',exigirLogin,async(req,res)=>{res.set('Cache-Control','no-store');try{const requested=String(req.query.termo||'').slice(0,80).trim();const terms=requested?[requested]:TERMS;const results=await Promise.allSettled(terms.map(fetchTerm));const unique=new Map();for(const result of results){if(result.status!=='fulfilled')continue;for(const item of result.value){const title=clean(item.title),body=clean(item.story_text),text=title+' '+body;if(!signal.test(text)||!relevance.test(text)||seller.test(text))continue;const id=String(item.objectID||'');if(!/^\\\\d+$/.test(id))continue;const dt=new Date(item.created_at);if(!Number.isFinite(+dt))continue;unique.set(id,{id,title,trecho:body.slice(0,300),url:'https://news.ycombinator.com/item?id='+id,criado_em:dt.toISOString(),fonte:'Hacker News',indicacao:'Indício textual; confirme o interesse no contexto da publicação.'});}}const ok=results.filter(x=>x.status==='fulfilled').length;const opportunities=[...unique.values()].sort((a,b)=>b.criado_em.localeCompare(a.criado_em)).slice(0,40);res.json({itens:opportunities,consultas_ok:ok,consultas_total:terms.length,periodo_dias:30,origem:'Publicações públicas indexadas pelo Hacker News',aviso:ok?'Somente discussões públicas com sinais textuais. Não são clientes validados nem contatos autorizados para WhatsApp.':'Fonte indisponível. Nenhum contato foi inventado.'});}catch(e){res.status(503).json({erro:'Não foi possível consultar publicações públicas agora.'});}});\nmodule.exports=app=>app.use('/api/admin/radar-interesse',router);\n");
fs.writeFileSync('public/admin-radar-interesse.html',"<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Radar de interesse · SaintsAI</title><script src=\"js/guard.js\"></script><style>body{margin:0;padding:18px;background:#0e0918;color:#f9f3ff;font:15px system-ui}main{max-width:960px;margin:auto}h1{margin:8px 0}p{line-height:1.5;color:#cbbbd9}a{color:#d6b0ff}.tabs{display:flex;gap:10px;flex-wrap:wrap;margin:15px 0}.tab{display:inline-block;border:1px solid #5f4476;padding:11px 16px;border-radius:12px;text-decoration:none}.active{background:#7530c5;color:#fff}button{background:#8139d9;color:white;border:0;border-radius:10px;padding:12px 16px;font-weight:bold}input{background:#1c122a;color:white;border:1px solid #694a81;border-radius:10px;padding:12px;min-width:0;flex:1}.search{display:flex;gap:8px;flex-wrap:wrap}.panel{border:1px solid #433055;background:#1a1026;padding:17px;border-radius:15px;margin:14px 0}article{border:1px solid #3c2c50;border-radius:12px;padding:15px;margin:10px 0}article h3{margin:0 0 7px;font-size:16px}small{color:#ae9ebe}.actions{display:flex;gap:9px;flex-wrap:wrap}.actions a,.actions button{display:inline-block;font-size:13px}.hint{font-size:12px;color:#b7a3c8}.notice{border-left:3px solid #c18aff;padding:10px 14px;background:#22142f}</style></head><body><main><a href=\"admin-mobile.html\">← Painel ADM</a><h1>Radar de clientes interessados</h1><p>Encontre conversas públicas de pessoas pedindo ajuda para automatizar atendimento, agendamentos ou WhatsApp. Confira cada publicação antes de participar.</p><div class=\"tabs\"><span class=\"tab active\">Sinais de interesse</span><a class=\"tab\" href=\"admin-prospeccao.html\">Busca tradicional por cidade</a></div><section class=\"panel\"><h2>Pesquisar oportunidades</h2><div class=\"search\"><input id=\"term\" placeholder=\"Ex.: preciso automatizar WhatsApp\" aria-label=\"Termo de busca\"><button id=\"find\">Buscar publicações</button></div><p class=\"hint\">Fonte inicial: Hacker News · até 30 dias. Publicações em português podem ser raras nessa fonte. Nenhuma mensagem será enviada automaticamente.</p><p id=\"status\" role=\"status\">Escolha Buscar publicações.</p><div id=\"results\"></div></section><section class=\"panel\"><h2>Outras buscas públicas</h2><p>Pesquise pedidos de ajuda em comunidades abertas. Resultados são exibidos no próprio site de origem; não são importados como contatos.</p><div class=\"actions\"><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"https://www.google.com/search?q=site%3Areddit.com%2Fr%2Fempreendedorismo+%22whatsapp%22+%22automatizar%22&amp;tbs=qdr:m\">Empreendedores no Reddit ↗</a><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"https://www.google.com/search?q=%22preciso%22+%22automatizar%22+%22whatsapp%22&amp;tbs=qdr:m\">Pedidos de automação ↗</a><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"https://www.google.com/search?q=%22agendamento%22+%22whatsapp%22+%22autom%C3%A1tico%22&amp;tbs=qdr:m\">Demandas de agendamento ↗</a></div></section><p class=\"notice\">O radar não comprova intenção de compra e não deve iniciar mensagens comerciais sem consentimento. Prefira participar publicamente onde a pessoa pediu recomendações.</p></main><script src=\"js/api.js\"></script><script src=\"js/radar-interesse.js\"></script></body></html>");
fs.writeFileSync('public/js/radar-interesse.js',"(()=>{'use strict';const $=id=>document.getElementById(id);const esc=s=>String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));async function find(){const b=$('find');b.disabled=true;$('status').textContent='Consultando publicações públicas...';$('results').replaceChildren();try{const term=$('term').value.trim(),r=await apiFetch('/admin/radar-interesse/sinais-publicos'+(term?'?termo='+encodeURIComponent(term):''));const list=r.itens||[];$('status').textContent=list.length?list.length+' sinais encontrados. Verifique se a pessoa realmente busca uma solução.':'Nenhum sinal verificável encontrado nesta pesquisa. Experimente outro termo ou as buscas públicas abaixo.';if(r.consultas_ok===0)$('status').textContent='Fonte temporariamente indisponível. Não foram gerados contatos artificiais.';for(const x of list){const node=document.createElement('article');node.innerHTML='<h3>'+esc(x.title)+'</h3><small>'+esc(x.fonte)+' · '+new Date(x.criado_em).toLocaleDateString('pt-BR')+'</small><p>'+esc(x.trecho||x.indicacao)+'</p><div class=\"actions\"><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"'+esc(x.url)+'\">Ler publicação original ↗</a> <button data-action=\"save\">Salvar na lista</button></div>';node.querySelector('button').onclick=()=>{const key='saintsai-radar-interesse-salvos',old=JSON.parse(localStorage.getItem(key)||'[]');if(!old.some(z=>z.url===x.url))old.push(x);localStorage.setItem(key,JSON.stringify(old));node.querySelector('button').textContent='Salvo';};$('results').append(node);}}catch(e){$('status').textContent='Não foi possível consultar: '+(e.message||'erro');}finally{b.disabled=false;}}$('find').onclick=find;$('term').addEventListener('keydown',e=>{if(e.key==='Enter')find()});})();");
let app=fs.readFileSync('src/app.js','utf8');const hook="require('./routes/radarInteresse.routes')(app);";if(!app.includes(hook)){const anchor="require('./routes/saintsaiEntrega.routes')(app);";if(!app.includes(anchor))throw Error('Radar route insertion anchor missing');app=app.replace(anchor,anchor+'\n'+hook);fs.writeFileSync('src/app.js',app);}
let adm=fs.readFileSync('public/admin-mobile.html','utf8');if(!adm.includes('href="admin-radar-interesse.html"'))adm=adm.replace('</body>',"<a href=\"admin-radar-interesse.html\" style=\"position:fixed;bottom:68px;right:14px;z-index:99999;padding:12px 18px;border-radius:12px;background:#422270;color:white;text-decoration:none;font:bold 14px system-ui\">◉ Radar de interessados</a></body>");fs.writeFileSync('public/admin-mobile.html',adm);
let old=fs.readFileSync('public/admin-prospeccao.html','utf8');if(!old.includes('href="admin-radar-interesse.html"'))old=old.replace('</body>',"<a href=\"admin-radar-interesse.html\" style=\"position:fixed;bottom:14px;right:14px;background:#7c39cc;color:#fff;padding:13px;border-radius:12px;z-index:9999;font:700 14px system-ui\">◉ Buscar interessados</a></body>");fs.writeFileSync('public/admin-prospeccao.html',old);
for(const file of ['src/routes/radarInteresse.routes.js','public/js/radar-interesse.js','src/app.js'])cp.execFileSync(process.execPath,['--check',file]);console.log('[radar-interesse] radar com fontes públicas e link original instalado');}
{const fs=require('node:fs'),p='src/routes/radarInteresse.routes.js';let s=fs.readFileSync(p,'utf8');const b=String.fromCharCode(92);for(const c of ['b','d','s'])s=s.replaceAll(b+b+c,b+c);fs.writeFileSync(p,s);console.log('[radar-interesse] filtros de intenção normalizados');}

{const fs=require('node:fs');const p='public/admin-mobile.html';let s=fs.readFileSync(p,'utf8');if(s.includes('id="home-prospecting"')&&!s.includes('id="prospecting-intent-hero"')){s=s.replace('<section id="home-prospecting"','<section id="prospecting-intent-hero" style="padding:18px;margin-bottom:14px;background:#1d102b;border:1px solid #654284;border-radius:15px"><small style="color:#c49af4">PROSPECÇÃO 2.0</small><h2 style="margin:8px 0">Encontre quem já procura automação</h2><p style="color:#cdbbdc;font-size:13px">Veja pedidos públicos recentes, com data e fonte original, antes de fazer qualquer abordagem.</p><a href="admin-radar-interesse.html" style="display:inline-block;background:#8438db;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold">◉ Abrir radar de interessados</a></section><section id="home-prospecting"');s=s.replace('<h2>Prospecção</h2>','<h2>Busca tradicional por cidades</h2>');fs.writeFileSync(p,s);console.log('[radar-interesse] navegação prioritária no painel ADM');}}

{const fs=require('node:fs'),cp=require('node:child_process');fs.writeFileSync('src/routes/radarInteresse.routes.js',"const express=require('express'),router=express.Router();\nconst {exigirLogin}=require('../middleware/auth');\nconst searches=['whatsapp automation','automate whatsapp','whatsapp booking','chatbot for business','customer service chatbot','automated appointment booking','atendimento whatsapp','automatizar agendamentos'];\nconst topics=/whatsapp|chatbot|customer support|appointment|booking|agendament|atendimento/i;\nconst need=/(looking for|recommend|any tools|any solution|need a|need to|how do i|how can|is there|anyone know|preciso|procuro|algu[eé]m conhece|algu[eé]m indica|recomend|como fazer|quero automatizar|trying to|struggling with)/i;\nconst promotions=/(we offer|buy our|book a demo|my agency offers|we are selling|compre agora|vendo automa[cç][aã]o)/i;\nconst clean=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'\"').replace(/&#x27;|&#39;/g,\"'\").replace(/\\s+/g,' ').trim().slice(0,700);\nasync function query(term){const url=new URL('https://hn.algolia.com/api/v1/search_by_date');url.searchParams.set('query',term);url.searchParams.set('tags','comment');url.searchParams.set('hitsPerPage','70');url.searchParams.set('numericFilters','created_at_i>'+Math.floor(Date.now()/1000-90*86400));const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const json=await r.json();return json.hits||[];}\nrouter.get('/sinais-publicos',exigirLogin,async(req,res)=>{res.set('Cache-Control','no-store');const t=String(req.query.termo||'').slice(0,90).trim();const terms=t?[t]:searches;const settles=await Promise.allSettled(terms.map(query));let successes=0;const rows=new Map();for(const v of settles){if(v.status!=='fulfilled')continue;successes++;for(const h of v.value){const body=clean(h.comment_text),title=clean(h.story_title||'Discussão pública');if(!topics.test(title+' '+body)||!need.test(body)||promotions.test(body))continue;const id=String(h.objectID||'');if(!/^\\d+$/.test(id))continue;const created=new Date(h.created_at);if(Number.isNaN(created.getTime()))continue;rows.set(id,{id,title,trecho:body.slice(0,450),url:'https://news.ycombinator.com/item?id='+id,criado_em:created.toISOString(),fonte:'Hacker News',indicacao:'Possível necessidade expressa em comentário. Verifique a publicação original.'});}}const itens=[...rows.values()].sort((a,b)=>b.criado_em.localeCompare(a.criado_em)).slice(0,50);res.json({itens,consultas_ok:successes,consultas_total:terms.length,periodo_dias:90,origem:'Hacker News · discussões públicas',aviso:successes===0?'Não foi possível acessar a fonte de publicações.':itens.length?'Sinais textuais públicos; interesse em comprar não confirmado.':'Nenhuma discussão recente correspondeu aos filtros. Use outras palavras e fontes.'});});\nmodule.exports=app=>app.use('/api/admin/radar-interesse',router);\n");cp.execFileSync(process.execPath,['--check','src/routes/radarInteresse.routes.js']);console.log('[radar-interesse] search comments, wider terms, 90-day real source');}

// Radar estadual: etapa de interface iniciada.


{
const fs=require('node:fs'),cp=require('node:child_process');
const states={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const pg='public/admin-radar-interesse.html';let h=fs.readFileSync(pg,'utf8');
h=h.replace('<input id="term" placeholder="Ex.: preciso automatizar WhatsApp" aria-label="Termo de busca">','<select id="uf" aria-label="Selecione um estado"></select>').replace('Buscar publicações</button>','Atualizar estado</button>').replace('Fonte inicial: Hacker News · até 30 dias. Publicações em português podem ser raras nessa fonte. Nenhuma mensagem será enviada automaticamente.','Busca automática por estado, sem digitar palavras. A origem deve comprovar a localidade.');
fs.writeFileSync(pg,h);
const path='public/js/radar-interesse.js';let j=fs.readFileSync(path,'utf8');
j=j.replace("const esc=s=>","const states="+JSON.stringify(states)+";const uf=$('uf');for(const [code,name] of Object.entries(states)){const o=document.createElement('option');o.value=code;o.textContent=name;uf.append(o)}uf.value=states[localStorage.getItem('saintsai-radar-uf')]?localStorage.getItem('saintsai-radar-uf'):'PR';const esc=s=>");
j=j.replace("const term=$('term').value.trim(),r=await apiFetch('/admin/radar-interesse/sinais-publicos'+(term?'?termo='+encodeURIComponent(term):''));","const r=await apiFetch('/admin/radar-interesse/sinais-publicos?uf='+encodeURIComponent(uf.value));");
j=j.replace("$('find').onclick=find;$('term').addEventListener('keydown',e=>{if(e.key==='Enter')find()});","$('find').onclick=find;uf.onchange=()=>{localStorage.setItem('saintsai-radar-uf',uf.value);find()};");
j=j.replace("})();","find();})();");
fs.writeFileSync(path,j);
const rt='src/routes/radarInteresse.routes.js';let s=fs.readFileSync(rt,'utf8');
s=s.replace("const t=String(req.query.termo||'').slice(0,90).trim();const terms=t?[t]:searches;","const uf=String(req.query.uf||'').toUpperCase();const states="+JSON.stringify(states)+";if(!states[uf])return res.status(400).json({erro:'Selecione um estado válido.'});const location=states[uf];const terms=searches.map(x=>x+' '+location);");
s=s.replace("if(!topics.test(title+' '+body)||!need.test(body)||promotions.test(body))continue;","if(!topics.test(title+' '+body)||!need.test(body)||promotions.test(body)||!(title+' '+body).toLocaleLowerCase('pt-BR').includes(location.toLocaleLowerCase('pt-BR')))continue;");
s=s.replace("res.json({itens,consultas_ok:successes,","res.json({uf,estado:location,itens,consultas_ok:successes,");
fs.writeFileSync(rt,s);
for(const x of [path,rt])cp.execFileSync(process.execPath,['--check',x]);
console.log('[radar] busca automática por estado aplicada');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const p='public/admin-radar-interesse.html';let s=fs.readFileSync(p,'utf8');
const old='<script src="js/api.js"></script>';
if(!s.includes(old))throw Error('API script not found');
s=s.replace(old,'<script src="js/auth.js"></script><script>if(typeof renovarSessao==="undefined"){window.renovarSessao=async function(){location.href="login.html";throw new Error("Sua sessão expirou. Faça login novamente.")}}</script>'+old);
fs.writeFileSync(p,s);
console.log('[radar] dependência de renovação de sessão carregada e fallback para login habilitado');
}


{
const fs=require('node:fs');
const path='public/admin-mobile.html';
let html=fs.readFileSync(path,'utf8');
html=html.replace(/<a\s+href="admin-status\.html"\s+style="position:fixed;[^"]*"[^>]*>[^<]*<\/a>/g,'');
html=html.replace(/<a\s+href="admin-radar-interesse\.html"\s+style="position:fixed;[^"]*"[^>]*>[^<]*<\/a>/g,'');
if(!html.includes('id="sa-ferramentas-links"')){
const nav='<section id="sa-ferramentas-links" style="margin:18px auto;padding:16px;max-width:1100px;box-sizing:border-box;background:#20142f;border:1px solid #4d3666;border-radius:16px"><h2 style="margin:0 0 12px;font-size:18px;color:#f6efff">Ferramentas do painel</h2><div style="display:flex;flex-wrap:wrap;gap:10px"><a href="admin-radar-interesse.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:12px;background:#7836cc;color:#fff;text-decoration:none;font:700 14px system-ui">◉ Radar inteligente</a><a href="admin-status.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:12px;background:#30243f;border:1px solid #6c4d84;color:#fff;text-decoration:none;font:700 14px system-ui">● Status do sistema</a></div></section>';
html=html.replace('</body>',nav+'</body>');
}
fs.writeFileSync(path,html);
console.log('[admin] atalhos Status e Radar movidos para secao própria, sem sobreposição');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const path='src/controllers/whatsappWahaWebhook.controller.js';
let s=fs.readFileSync(path,'utf8');
const human="update({ativo:false,atualizado_em:new Date().toISOString()})";
if(!s.includes(human))throw Error('Manual intervention update anchor missing');
s=s.replace(human,"update({ativo:false,pausa_humana:true,ultima_atividade_humana_em:new Date().toISOString(),atualizado_em:new Date().toISOString()})");
const point="  const chaveId={provedor:'waha',idExterno:evento.idExterno};";
if(!s.includes(point))throw Error('Incoming WAHA entry point missing');
const guard=[
"  // Pausa automatica por intervencao humana; volta somente apos 10 minutos de silencio.",
"  try {",
"    const db=require('../config/supabase');",
"    const {data:pause,error:pe}=await db.from('saintsai_sales_conversations').select('id,pausa_humana,ultima_atividade_humana_em').eq('session_id',evento.destinatarioId).eq('contato',evento.contato).eq('pausa_humana',true).maybeSingle();",
"    if(pe)throw pe;",
"    if(pause){",
"      const elapsed=Date.now()-new Date(pause.ultima_atividade_humana_em||0).getTime();",
"      if(Number.isFinite(elapsed)&&elapsed>=600000){",
"        const {error:re}=await db.from('saintsai_sales_conversations').update({ativo:true,pausa_humana:false,atualizado_em:new Date().toISOString()}).eq('id',pause.id).eq('pausa_humana',true).eq('ultima_atividade_humana_em',pause.ultima_atividade_humana_em);",
"        if(re)throw re;",
"        console.log('[waha.sales] retomada_apos_10min_silencio');",
"      }else{",
"        const now=new Date().toISOString();",
"        const {error:ue}=await db.from('saintsai_sales_conversations').update({ultima_atividade_humana_em:now,atualizado_em:now}).eq('id',pause.id).eq('pausa_humana',true);",
"        if(ue)throw ue;",
"        console.log('[waha.sales] pausa_humana_atividade_cliente');",
"        return res.status(200).json({status:'pausa_humana_ativa'});",
"      }",
"    }",
"  }catch(e){console.error('[waha.sales] controle_pausa_humana',e?.message||e);return res.status(500).json({erro:'Falha no controle da pausa humana'});}",
""].join('\n');
s=s.replace(point,guard+point);
fs.writeFileSync(path,s);cp.execFileSync(process.execPath,['--check',path]);
console.log('[waha.sales] vendedor assume, IA silencia e retoma apos 10 min sem atividade');
}


{
const fs=require('node:fs'),cp=require('node:child_process'),p='src/controllers/whatsappWahaWebhook.controller.js';
let s=fs.readFileSync(p,'utf8');const before="loja_id:configs[0].loja_id,ativo:true,ultimo_evento_id:'prospeccao:iniciado:'+Date.now()";
if(!s.includes(before))throw Error('Activation state hook not found');
s=s.replace(before,"loja_id:configs[0].loja_id,ativo:true,pausa_humana:false,ultima_atividade_humana_em:null,ultimo_evento_id:'prospeccao:iniciado:'+Date.now()");
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);console.log('[waha.sales] novo início manual limpa pausa antiga');
}


{
const fs=require('node:fs'),cp=require('node:child_process'),p='src/controllers/whatsappWahaWebhook.controller.js';
let s=fs.readFileSync(p,'utf8');const marker='  if (evento.fromMe === true) {';
if(!s.includes(marker))throw Error('WAHA owner message hook missing');
const middleware=[
"  // Pausa de 10 minutos para todas as lojas conectadas por WAHA.",
"  try{",
"    const db=require('../config/supabase');",
"    const {data:cfg,error:ce}=await db.from('whatsapp_configuracoes').select('loja_id').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(2);",
"    if(ce)throw ce;",
"    if(cfg?.length===1){",
"      const lojaId=cfg[0].loja_id;",
"      if(evento.fromMe===true && String(evento.source||'').toLowerCase()!=='api'){",
"        const text=String(evento.texto||'').trim();",
"        const intro=require('../services/ownerSalesPrompt').INTRO;",
"        const isActivation=text===intro||text===GATILHO_VENDAS;",
"        if(!isActivation){const {error}=await db.from('saintsai_human_handoff').upsert({loja_id:lojaId,contato:evento.contato,session_id:evento.destinatarioId,ultima_atividade_em:new Date().toISOString(),atualizado_em:new Date().toISOString()},{onConflict:'loja_id,contato'});if(error)throw error;}",
"      }else if(evento.fromMe!==true){",
"        const {data:pause,error:pe}=await db.from('saintsai_human_handoff').select('ultima_atividade_em').eq('loja_id',lojaId).eq('contato',evento.contato).maybeSingle();",
"        if(pe)throw pe;",
"        if(pause){const elapsed=Date.now()-new Date(pause.ultima_atividade_em).getTime();",
"          if(elapsed>=600000){const {error:e}=await db.from('saintsai_human_handoff').delete().eq('loja_id',lojaId).eq('contato',evento.contato).eq('ultima_atividade_em',pause.ultima_atividade_em);if(e)throw e;}",
"          else{const now=new Date().toISOString();const {error:e}=await db.from('saintsai_human_handoff').update({ultima_atividade_em:now,atualizado_em:now}).eq('loja_id',lojaId).eq('contato',evento.contato);if(e)throw e;return res.status(200).json({status:'em_atendimento_humano'});}",
"        }",
"      }",
"    }",
"  }catch(e){console.error('[waha] human_handoff',e?.message||e);return res.status(500).json({erro:'Falha ao verificar atendimento humano'});}",
""].join('\n');
s=s.replace(marker,middleware+marker);
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);console.log('[waha] pausa de 10 minutos implementada para todas as lojas');
}

{const fs=require('node:fs'),cp=require('node:child_process');
fs.writeFileSync('src/routes/saintsaiCopiloto.routes.js',"const express=require('express'), db=require('../config/supabase');const {exigirLogin}=require('../middleware/auth');const router=express.Router();router.use(exigirLogin);router.use(express.json({limit:'8kb'}));\nasync function own(req,res,next){const id=String(req.params.lojaId||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({erro:'Loja inválida.'});const q=await db.from('lojas').select('id').eq('id',id).eq('dono_id',req.usuario?.id).maybeSingle();if(q.error)return res.status(503).json({erro:'Não foi possível verificar acesso.'});if(!q.data)return res.status(403).json({erro:'Você não gerencia esta loja.'});next();}\nrouter.get('/:lojaId',own,async(req,res)=>{const q=await db.from('saintsai_copilot_actions').select('id,contato,estado,criado_em,enviado_em,erro').eq('loja_id',req.params.lojaId).order('criado_em',{ascending:false}).limit(30);if(q.error)return res.status(503).json({erro:'Falha ao consultar ações.'});res.json({acoes:q.data||[],modo:'aprovação_humana',automatico:false});});\nrouter.post('/:lojaId/sugerir',own,async(req,res)=>{const telefone=String(req.body?.contato||'').replace(/\\D/g,'');if(!/^55\\d{10,11}$/.test(telefone))return res.status(400).json({erro:'Informe um WhatsApp brasileiro válido com DDD.'});const q=await db.from('saintsai_copilot_actions').insert({loja_id:req.params.lojaId,contato:telefone,tipo:'demo_menu',estado:'pendente'}).select('id,contato,estado').single();if(q.error)return res.status(503).json({erro:'Não foi possível preparar sugestão.'});res.status(201).json({...q.data,mensagem:'Demonstração pronta para aprovação. Nada foi enviado.'});});\nrouter.post('/:lojaId/:actionId/aprovar',own,async(req,res)=>{const q=await db.from('saintsai_copilot_actions').select('*').eq('loja_id',req.params.lojaId).eq('id',req.params.actionId).maybeSingle();if(q.error)return res.status(503).json({erro:'Falha ao verificar sugestão.'});if(!q.data)return res.status(404).json({erro:'Sugestão não encontrada.'});if(q.data.estado!=='pendente')return res.status(409).json({erro:'Esta ação já foi processada.'});const cfg=await db.from('whatsapp_configuracoes').select('id,provedor,identificador_externo').eq('loja_id',req.params.lojaId).eq('ativo',true).limit(4);if(cfg.error)return res.status(503).json({erro:'Falha ao localizar WhatsApp.'});const w=cfg.data?.find(x=>x.provedor==='meta')||cfg.data?.find(x=>x.provedor==='waha');if(!w)return res.status(409).json({erro:'Conecte o WhatsApp da loja.'});const claim=await db.from('saintsai_copilot_actions').update({estado:'enviando',aprovado_por:req.usuario?.id,aprovado_em:new Date().toISOString()}).eq('id',q.data.id).eq('estado','pendente').select('id').maybeSingle();if(claim.error)return res.status(503).json({erro:'Falha na aprovação.'});if(!claim.data)return res.status(409).json({erro:'Outra aprovação já ocorreu.'});try{const action=require('../services/acoesWhatsapp.service');const interativo=action.escolhas([{value:'demo agendamento',title:'Agendamento'},{value:'demo pagamento',title:'Pagamento'},{value:'demo atendimento',title:'Atendimento IA'}]);const contact=q.data.contato+'@c.us';const msg={canal:'whatsapp',lojaId:req.params.lojaId,configuracaoId:w.id,contato:contact,idExterno:'copiloto-'+q.data.id,timestamp:new Date().toISOString()};const resposta={lojaId:req.params.lojaId,contato:contact,idExterno:msg.idExterno,resposta:'Veja algumas funções do SaintsAI. Qual você gostaria de conhecer?',interativo};const result=await require('../services/whatsappEnvio.service').enviarRespostaWhatsapp(msg,resposta,{provedor:w.provedor,destinatarioId:w.identificador_externo});await db.from('saintsai_copilot_actions').update({estado:'enviado',enviado_em:new Date().toISOString()}).eq('id',q.data.id);res.json({ok:true,estado:'enviado',resultado:result?.status||'processado'});}catch(e){await db.from('saintsai_copilot_actions').update({estado:'falhou',erro:String(e?.message||'Falha de envio').slice(0,300)}).eq('id',q.data.id);res.status(503).json({erro:'Falha ao enviar menu. Verifique a conexão e o formato de botões suportado.'});}});\nrouter.post('/:lojaId/:actionId/cancelar',own,async(req,res)=>{const q=await db.from('saintsai_copilot_actions').update({estado:'cancelado'}).eq('loja_id',req.params.lojaId).eq('id',req.params.actionId).eq('estado','pendente').select('id').maybeSingle();if(q.error)return res.status(503).json({erro:'Falha ao cancelar.'});res.json({ok:!!q.data});});\nmodule.exports=app=>app.use('/api/lojas/copiloto',router);\n");
fs.writeFileSync('public/cliente-copiloto.html',"<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Copiloto · SaintsAI</title><script src=\"js/guard.js\"></script><style>body{background:#110a1d;color:#faf6ff;font:16px system-ui;margin:0;padding:20px}main{max-width:800px;margin:0 auto}.panel{background:#241430;border:1px solid #56366d;border-radius:16px;padding:20px;margin:14px 0}input,select,button{font:inherit;box-sizing:border-box;border-radius:11px;padding:12px}input,select{width:100%;background:#171021;border:1px solid #785391;color:#fff;margin:6px 0 13px}button{background:#8038d2;border:0;color:white;font-weight:bold;cursor:pointer}button:disabled{opacity:.5}a{color:#d5b1ff}small,p{color:#ccb9de}article{padding:15px;margin:10px 0;border:1px solid #5c4176;border-radius:12px}.actions{display:flex;gap:10px;flex-wrap:wrap}h1{margin-bottom:6px}</style></head><body><main><a href=\"cliente-central.html\">← Voltar ao painel</a><h1>Copiloto de vendas</h1><p>Você conduz a conversa; o SaintsAI somente envia a demonstração depois que aprovar a ação.</p><div class=\"panel\"><label for=\"phone\">WhatsApp do cliente (com DDD)</label><input id=\"phone\" inputmode=\"tel\" placeholder=\"5543999999999\"/><button id=\"suggest\">Preparar demonstração</button><p id=\"message\" role=\"status\"></p></div><div class=\"panel\"><h2>Aguardando sua aprovação</h2><p>As sugestões não são enviadas automaticamente. Confira o número antes de aprovar.</p><div id=\"actions\"></div><button id=\"refresh\">Atualizar lista</button></div><small>Botões interativos dependem do provedor WhatsApp conectado. No QR/WAHA, a compatibilidade pode variar.</small></main><script src=\"js/api.js\"></script><script src=\"js/cliente-copiloto.js\"></script></body></html>");
fs.writeFileSync('public/js/cliente-copiloto.js',"(()=>{'use strict';const $=id=>document.getElementById(id);let loja;async function getStore(){if(!loja)loja=await obterLojaAtual();if(!loja)throw Error('Selecione uma loja.');return loja}async function refresh(){try{const l=await getStore(),data=await apiFetch('/lojas/copiloto/'+l.id);$('actions').replaceChildren();for(const x of data.acoes||[]){const article=document.createElement('article'),title=document.createElement('b');title.textContent=x.contato+' · '+x.estado;article.append(title);if(x.estado==='pendente'){const actions=document.createElement('div');actions.className='actions';for(const [name,url] of [['Aprovar e enviar','aprovar'],['Cancelar','cancelar']]){const b=document.createElement('button');b.textContent=name;b.onclick=async()=>{if(url==='aprovar'&&!confirm('Enviar demonstração para '+x.contato+'?'))return;b.disabled=true;try{await apiFetch('/lojas/copiloto/'+l.id+'/'+x.id+'/'+url,{method:'POST',body:'{}'});$('message').textContent=url==='aprovar'?'Ação processada. Confira o status do envio.':'Sugestão cancelada.';}catch(e){$('message').textContent=e.message}await refresh()};actions.append(b)}article.append(actions)}$('actions').append(article)}if(!data.acoes?.length)$('actions').textContent='Nenhuma demonstração preparada.';}catch(e){$('message').textContent=e.message}}$('suggest').onclick=async()=>{try{const l=await getStore();await apiFetch('/lojas/copiloto/'+l.id+'/sugerir',{method:'POST',body:JSON.stringify({contato:$('phone').value})});$('message').textContent='Sugestão criada. Nenhuma mensagem enviada.';refresh()}catch(e){$('message').textContent=e.message}};$('refresh').onclick=refresh;refresh()})();");
let app=fs.readFileSync('src/app.js','utf8');const hook="require('./routes/saintsaiCopiloto.routes')(app);";if(!app.includes(hook)){const anchor="require('./routes/radarInteresse.routes')(app);";if(!app.includes(anchor))throw Error('Cannot mount copilot route');app=app.replace(anchor,anchor+'\n'+hook);fs.writeFileSync('src/app.js',app)}
let page=fs.readFileSync('public/cliente-central.html','utf8');if(!page.includes('href="cliente-copiloto.html"'))page=page.replace('</body>',"<a href=\"cliente-copiloto.html\" style=\"position:fixed;bottom:80px;right:12px;background:#6628ac;color:#fff;padding:12px;border-radius:12px;text-decoration:none;font:700 14px system-ui\">✨ Copiloto</a></body>");fs.writeFileSync('public/cliente-central.html',page);
for(const p of ['src/routes/saintsaiCopiloto.routes.js','public/js/cliente-copiloto.js'])cp.execFileSync(process.execPath,['--check',p]);console.log('[copiloto] aprovação humana antes de qualquer menu demonstrativo');}

{const fs=require('node:fs');const p='public/cliente-central.html';let s=fs.readFileSync(p,'utf8');s=s.replace('style="position:fixed;bottom:80px;right:12px;background:#6628ac;color:#fff;padding:12px;border-radius:12px;text-decoration:none;font:700 14px system-ui"','style="display:inline-flex;margin:14px;padding:13px 18px;background:#6628ac;color:#fff;border-radius:12px;text-decoration:none;font:700 14px system-ui"');fs.writeFileSync(p,s);console.log('[copiloto] acesso sem botão flutuante');}


{
const fs=require('node:fs'),cp=require('node:child_process');const p='src/controllers/whatsappWahaWebhook.controller.js';let s=fs.readFileSync(p,'utf8');const anchor="  // Pausa de 10 minutos para todas as lojas conectadas por WAHA.";
if(!s.includes(anchor))throw Error('WAHA copilot suggestion hook missing');
const capture=[
"  // Copiloto: observa interesse expresso enquanto atendimento humano está ativo.",
"  if(evento.fromMe!==true){try{",
"    const phrase=String(evento.texto||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();",
"    if(/(?:quero ver|pode mostrar|me mostra|mostra os botoes|quero uma demonstracao|como funciona o agendamento|me manda as opcoes)/.test(phrase)){",
"      const db=require('../config/supabase');",
"      const cfg=await db.from('whatsapp_configuracoes').select('loja_id').eq('identificador_externo',evento.destinatarioId).eq('ativo',true).limit(2);",
"      if(cfg.error)throw cfg.error;",
"      if(cfg.data?.length===1){const lojaId=cfg.data[0].loja_id;",
"        const h=await db.from('saintsai_human_handoff').select('contato').eq('loja_id',lojaId).eq('contato',evento.contato).maybeSingle();if(h.error)throw h.error;",
"        if(h.data){const phone=String(evento.contato||'').replace(/\\D/g,'');",
"          const existing=await db.from('saintsai_copilot_actions').select('id').eq('loja_id',lojaId).eq('contato',phone).eq('estado','pendente').limit(1);if(existing.error)throw existing.error;",
"          if(!existing.data?.length&&/^55\\d{10,11}$/.test(phone)){const q=await db.from('saintsai_copilot_actions').insert({loja_id:lojaId,contato:phone,tipo:'demo_menu',estado:'pendente'});if(q.error)throw q.error;}",
"        }}",
"      }",
"  }catch(e){console.error('[copiloto] sugestao_falhou',e?.message||e);}}",
""].join('\n');
s=s.replace(anchor,capture+anchor);
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);console.log('[copiloto] sugestao de demo criada em conversa humana, sem envio automatico');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const pix='src/services/entregaPix.service.js';let s=fs.readFileSync(pix,'utf8');
const validation="if(!row.pagamento_referencia||!p.pixQrCodeId||row.pagamento_referencia!==p.pixQrCodeId)return true;";
if(!s.includes(validation))throw Error('Asaas validation expected');
s=s.replace(validation,"if(!row.pagamento_referencia||!p.pixQrCodeId||row.pagamento_referencia!==p.pixQrCodeId)return true;");
fs.writeFileSync(pix,s);
const order='src/routes/saintsaiEntrega.routes.js';let r=fs.readFileSync(order,'utf8');
const get="r.get('/pedidos',async(req,res)=>";
if(!r.includes(get))throw Error('Delivery orders endpoint absent');
r=r.replace(get,"r.get('/resumo',async(req,res)=>{try{const cfg=await db.from('saintsai_delivery_preferences').select('entrega_ativa,prazo_texto').eq('loja_id',req.params.lojaId).maybeSingle();if(cfg.error)throw cfg.error;const q=await db.from('saintsai_delivery_orders').select('id,status,pagamento_status,modalidade').eq('loja_id',req.params.lojaId).limit(200);if(q.error)throw q.error;const pedidos=q.data||[];res.json({ativo:!!cfg.data?.entrega_ativa,prazo:cfg.data?.prazo_texto||null,total:pedidos.length,aguardando_pagamento:pedidos.filter(x=>x.pagamento_status==='pendente').length,em_preparo:pedidos.filter(x=>x.status==='preparando').length,em_rota:pedidos.filter(x=>x.status==='em_rota').length});}catch(e){res.status(503).json({erro:'Não foi possível carregar o resumo de entregas.'});}});\n"+get);
fs.writeFileSync(order,r);
const html='public/cliente-entregas.html';let h=fs.readFileSync(html,'utf8');if(!h.includes('id="delivery-summary"'))h=h.replace('<section class="panel" style="margin-top:20px">','<section class="panel" id="delivery-summary" style="margin-top:20px"><h2>Visão geral de entregas</h2><p id="delivery-numbers">Carregando pedidos...</p></section><section class="panel" style="margin-top:20px">');
fs.writeFileSync(html,h);
const ui='public/js/cliente-pedidos-entrega.js';let u=fs.readFileSync(ui,'utf8');const insert="const l=await store(),r=await apiFetch('/lojas/'+l.id+'/entrega-config/pedidos');";
if(!u.includes(insert))throw Error('Delivery dashboard list anchor absent');
u=u.replace(insert,insert+"const summary=await apiFetch('/lojas/'+l.id+'/entrega-config/resumo');g('delivery-numbers').textContent=(summary.ativo?'Entregas ativadas':'Entregas desativadas')+' · '+summary.total+' pedidos · '+summary.aguardando_pagamento+' aguardando pagamento · '+summary.em_preparo+' em preparo · '+summary.em_rota+' em rota';");
fs.writeFileSync(ui,u);
for(const p of [pix,order,ui])cp.execFileSync(process.execPath,['--check',p]);
console.log('[entrega] visao geral do acompanhamento operacional e preferencia salva');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const p='src/routes/saintsaiCopiloto.routes.js';let s=fs.readFileSync(p,'utf8');
const old="const interativo=action.escolhas([{value:'demo agendamento',title:'Agendamento'},{value:'demo pagamento',title:'Pagamento'},{value:'demo atendimento',title:'Atendimento IA'}]);";
if(!s.includes(old))throw Error('Copilot demo menu selection anchor missing');
const nw="const found=await db.from('saintsai_servicos').select('nome,preco').eq('loja_id',req.params.lojaId).eq('ativo',true).order('nome').limit(7);if(found.error)throw found.error;const serviceChoices=(found.data||[]).filter(x=>x.nome&&x.nome.length<=100).map(x=>({value:x.nome,title:String(x.nome).slice(0,24),description:Number.isFinite(Number(x.preco))?'R$ '+Number(x.preco).toFixed(2).replace('.',','):'Serviço disponível',forceList:true}));const options=serviceChoices.length?serviceChoices:[{value:'demo agendamento',title:'Agendamento'},{value:'demo pagamento',title:'Pagamento'},{value:'demo atendimento',title:'Atendimento IA'}];const interativo=action.escolhas(options);";
s=s.replace(old,nw);
s=s.replace("resposta:'Veja algumas funções do SaintsAI. Qual você gostaria de conhecer?',interativo","resposta:serviceChoices.length?'Estes são os serviços da loja. Escolha uma opção para conhecer o agendamento:':'Veja algumas funções do SaintsAI. Qual você gostaria de conhecer?',interativo");
const result="await db.from('saintsai_copilot_actions').update({estado:'enviado',enviado_em:new Date().toISOString()}).eq('id',q.data.id);";
if(!s.includes(result))throw Error('Copilot send acknowledgment anchor missing');
s=s.replace(result,"if(result?.status==='falhou'||result?.status==='erro'||result?.erro||result?.ok===false)throw Error('O WhatsApp recusou o envio.');"+result);
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);console.log('[copiloto] menu conforme servicos cadastrados e verificacao de falhas de envio');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const nav='public/js/cliente-dashboard-v2.js';let s=fs.readFileSync(nav,'utf8');
const cop="['sparkles','Copiloto','cliente-copiloto.html']";
const delivery="['truck','Entregas','cliente-entregas.html']";
if(!s.includes(cop)){const anchor="['gallery','Galeria','cliente-galeria.html']";if(!s.includes(anchor))throw Error('Menu do cliente não localizado');s=s.replace(anchor,anchor+','+cop);}
if(!s.includes(delivery)){const anchor="['gallery','Galeria','cliente-galeria.html']";if(!s.includes(anchor))throw Error('Menu para entregas não localizado');s=s.replace(anchor,anchor+','+delivery);}
fs.writeFileSync(nav,s);
const home='public/cliente-central.html';let h=fs.readFileSync(home,'utf8');h=h.replace(/<a href="cliente-(?:entregas|copiloto)\.html" style="position:fixed;[^"]*"[^>]*>[^<]*<\/a>/g,'');
fs.writeFileSync(home,h);
cp.execFileSync(process.execPath,['--check',nav]);
console.log('[cliente] Copiloto e Entregas adicionados ao menu interno do app, sem atalhos sobrepostos');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const route='src/routes/saintsaiCopiloto.routes.js';let s=fs.readFileSync(route,'utf8');
s=s.replaceAll("req.usuario?.id","(req.usuario?.id||req.user?.id)");
const anchor="router.get('/:lojaId',own,";
if(!s.includes(anchor))throw Error('Copilot route context anchor missing');
s=s.replace(anchor,"router.get('/contexto',async(req,res)=>{const uid=req.usuario?.id||req.user?.id;if(!uid)return res.status(401).json({erro:'Faça login novamente.'});const q=await db.from('lojas').select('id,nome').eq('dono_id',uid).limit(50);if(q.error)return res.status(503).json({erro:'Não foi possível carregar suas lojas.'});res.json({lojas:q.data||[]});});\n"+anchor);
s=s.replace("const telefone=String(req.body?.contato||'').replace(/\\D/g,'');if(!/^55\\d{10,11}$/.test(telefone))","let telefone=String(req.body?.contato||'').replace(/\\D/g,'');if(/^\\d{10,11}$/.test(telefone))telefone='55'+telefone;if(!/^55\\d{10,11}$/.test(telefone))");
fs.writeFileSync(route,s);cp.execFileSync(process.execPath,['--check',route]);
const js='public/js/cliente-copiloto.js';let c=fs.readFileSync(js,'utf8');
const original="if(!loja)loja=await obterLojaAtual();if(!loja)throw Error('Selecione uma loja.');return loja";
if(!c.includes(original))throw Error('Client getStore hook missing');
c=c.replace(original,"if(!loja){const data=await apiFetch('/lojas/copiloto/contexto');const available=data.lojas||[];if(!available.length)throw Error('Nenhuma loja vinculada à sua conta.');const saved=localStorage.getItem('saintsai-copiloto-loja');loja=available.find(l=>l.id===saved)||available[0];localStorage.setItem('saintsai-copiloto-loja',loja.id);}return loja");
fs.writeFileSync(js,c);cp.execFileSync(process.execPath,['--check',js]);
console.log('[copiloto] obterLojaAtual ausente resolvido com endpoint autenticado e telefone brasileiro normalizado');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const p='public/cliente-copiloto.html';let h=fs.readFileSync(p,'utf8');
h=h.replace(/src="js\/cliente-copiloto\.js(?:\?[^"]*)?"/g,'src="js/cliente-copiloto.js?v=20261011-c3"');
h=h.replace('<script src="js/api.js"></script>','<script src="js/auth.js"></script><script src="js/api.js"></script>');
fs.writeFileSync(p,h);
const src='public/js/cliente-copiloto.js';let c=fs.readFileSync(src,'utf8');
c=c.replace("const $=id=>document.getElementById(id);let loja;","const $=id=>document.getElementById(id);let loja;const status=$('message');if(status)status.textContent='Copiloto atualizado · validando acesso à loja...';");
c=c.replace("e.message}}$('suggest').onclick","(e.message||'Falha ao consultar loja')+' · Atualize a página e entre novamente se necessário.'}}$('suggest').onclick");
fs.writeFileSync(src,c);cp.execFileSync(process.execPath,['--check',src]);console.log('[copiloto] bust cache, autenticação carregada e diagnóstico visível');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const p='public/cliente-copiloto.html';let h=fs.readFileSync(p,'utf8');
const target='<script src="js/auth.js"></script><script src="js/api.js"></script>';
if(!h.includes(target))throw Error('Copilot scripts auth anchor not found');
h=h.replace(target,'<script src="js/auth.js"></script><script>if(typeof renovarSessao==="undefined"){window.renovarSessao=async function(){return false;}}</script><script src="js/api.js"></script>');
h=h.replace(/src="js\/cliente-copiloto\.js(?:\?[^"]*)?"/g,'src="js/cliente-copiloto.js?v=20261011-c4"');
fs.writeFileSync(p,h);
const js='public/js/cliente-copiloto.js';let j=fs.readFileSync(js,'utf8');
j=j.replace("if(!loja){const data=await apiFetch('/lojas/copiloto/contexto');","if(!loja){const data=await apiFetch('/lojas/copiloto/contexto');");
j=j.replace("}catch(e){$('message').textContent=e.message}}$('suggest').onclick","}catch(e){$('message').textContent='Falha ao consultar Copiloto: '+(e?.message||String(e))}}$('suggest').onclick");
fs.writeFileSync(js,j);cp.execFileSync(process.execPath,['--check',js]);console.log('[copiloto] helper de sessão garantido antes do apiFetch e JS recarregado');
}


{
const fs=require('node:fs'),cp=require('node:child_process');
const p='public/js/cliente-copiloto.js';let s=fs.readFileSync(p,'utf8');
const anchor="async function getStore(){";
const helper="async function copRequest(path,options){const r=await fetch('/api'+path,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(options?.headers||{})}});const data=await r.json().catch(()=>null);if(!r.ok)throw Error('HTTP '+r.status+': '+(data?.erro||'Falha de autenticação ou rota'));return data;}";
if(!s.includes(anchor))throw Error('Copilot function missing');
s=s.replace(anchor,helper+anchor);
s=s.replaceAll("apiFetch('/lojas/copiloto/","copRequest('/lojas/copiloto/");
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);
const h='public/cliente-copiloto.html';let html=fs.readFileSync(h,'utf8');html=html.replace(/src="js\/cliente-copiloto\.js(?:\?[^"]*)?"/g,'src="js/cliente-copiloto.js?v=20261011-c5"');fs.writeFileSync(h,html);
console.log('[copiloto] requisição same-origin com código HTTP e cache atualizado');
}


{
const fs=require('node:fs'),cp=require('node:child_process'),p='public/js/cliente-copiloto.js';
let s=fs.readFileSync(p,'utf8');
const before="const r=await fetch('/api'+path,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(options?.headers||{})}});";
if(!s.includes(before))throw Error('Copiloto API request anchor missing');
const replacement="const findToken=()=>{for(const storage of [localStorage,sessionStorage]){for(const key of ['saintsai_token','access_token','token','auth_token','saintsai_access_token','supabase.auth.token']){let value=storage.getItem(key);if(!value)continue;try{const v=JSON.parse(value);value=v?.access_token||v?.token||v?.currentSession?.access_token||v?.session?.access_token||value;}catch(_){}if(typeof value==='string'&&value.split('.').length===3)return value;}}return null;};const token=findToken();const r=await fetch('/api'+path,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(options?.headers||{})}});";
s=s.replace(before,replacement);
fs.writeFileSync(p,s);cp.execFileSync(process.execPath,['--check',p]);
const h='public/cliente-copiloto.html';let html=fs.readFileSync(h,'utf8');html=html.replace(/src="js\/cliente-copiloto\.js(?:\?[^"]*)?"/g,'src="js/cliente-copiloto.js?v=20261011-c6"');fs.writeFileSync(h,html);
console.log('[copiloto] token bearer enviado para API no mesmo dominio');
}
