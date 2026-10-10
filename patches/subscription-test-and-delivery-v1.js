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