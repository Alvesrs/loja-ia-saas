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
