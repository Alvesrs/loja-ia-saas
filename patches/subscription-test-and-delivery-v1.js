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
