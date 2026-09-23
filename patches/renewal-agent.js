const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}

// ---------- Serviço de renovação automática ----------
write('src/services/renovacao.service.js', `
const supabase=require('../config/supabase');
const {listarPlanos}=require('../config/planos');

const INTERVALO_MS=60*60*1000;
let timer=null;
let executando=false;

function digitos(v){return String(v||'').replace(/\\D/g,'');}
function contatoConfere(a,b){
  const x=digitos(a),y=digitos(b);
  if(!x||!y)return false;
  const n=Math.min(11,x.length,y.length);
  return n>=10 && x.slice(-n)===y.slice(-n);
}
function moeda(c){return (Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dataBr(v){
  const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
}

async function configWaha(lojaId){
  const {data,error}=await supabase.from('whatsapp_configuracoes')
    .select('identificador_externo,provedor,ativo')
    .eq('loja_id',lojaId).eq('provedor','waha').eq('ativo',true)
    .order('criado_em',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  return data||null;
}

async function enviarTexto(lojaId,numero,texto){
  const base=String(process.env.WAHA_BASE_URL||'').replace(/\\/+$/,'');
  const apiKey=String(process.env.WAHA_API_KEY||'');
  if(!base||!apiKey)return false;
  const cfg=await configWaha(lojaId);
  if(!cfg?.identificador_externo)return false;
  const numeroLimpo=digitos(numero);
  if(!numeroLimpo)return false;
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(base+'/api/sendText',{
      method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':apiKey},
      body:JSON.stringify({session:cfg.identificador_externo,chatId:numeroLimpo+'@c.us',text:String(texto)}),
      signal:ctrl.signal
    });
    return r.ok;
  }catch(_){return false;}finally{clearTimeout(timeout);}
}

function planosVendaveis(){
  return listarPlanos().filter(p=>p.vendavel&&p.precoMensalCentavos);
}
function textoPlanos(){
  return planosVendaveis().map((p,i)=>
    (i+1)+' - '+p.nome+' · '+moeda(p.precoMensalCentavos)+'/mês'
  ).join('\\n');
}
function acharPlano(resposta){
  const t=String(resposta||'').trim().toLowerCase();
  const ps=planosVendaveis();
  const n=Number(t.replace(/\\D/g,''));
  if(Number.isInteger(n)&&n>=1&&n<=ps.length)return ps[n-1];
  return ps.find(p=>t===String(p.codigo).toLowerCase()||t.includes(String(p.nome||'').toLowerCase()))||null;
}
function acharDuracao(resposta){
  const n=Number(String(resposta||'').match(/\\d+/)?.[0]||0);
  return [1,3,6,12].includes(n)?n:null;
}

async function salvarSessao(lojaId,patch){
  const agora=new Date().toISOString();
  const {data:existente,error:e}=await supabase.from('renovacao_sessoes').select('*').eq('loja_id',lojaId).maybeSingle();
  if(e)throw e;
  if(existente){
    const {data,error}=await supabase.from('renovacao_sessoes').update({...patch,atualizado_em:agora})
      .eq('id',existente.id).select('*').single();
    if(error)throw error;return data;
  }
  const {data,error}=await supabase.from('renovacao_sessoes').insert({loja_id:lojaId,...patch,atualizado_em:agora})
    .select('*').single();
  if(error)throw error;return data;
}

async function reservarAviso(assinatura,dias){
  const {data,error}=await supabase.from('renovacao_avisos').insert({
    loja_id:assinatura.loja_id,assinatura_id:assinatura.id,dias_antes:dias
  }).select('id').maybeSingle();
  if(!error)return data?.id||null;
  if(String(error.code||'')==='23505')return null;
  throw error;
}

async function desfazerAviso(id){
  if(!id)return;
  try{await supabase.from('renovacao_avisos').delete().eq('id',id);}catch(_){}
}

async function avisarAssinatura(assinatura,dias){
  const {data:loja,error}=await supabase.from('lojas')
    .select('id,nome,numero_dono_whatsapp').eq('id',assinatura.loja_id).maybeSingle();
  if(error||!loja?.numero_dono_whatsapp)return false;

  const reserva=await reservarAviso(assinatura,dias);
  if(!reserva)return false;

  const quando=dias===0?'hoje':(dias===1?'amanhã':'em '+dias+' dias');
  const texto=
    'Olá! Aqui é o agente SaintsAI de '+loja.nome+'.\\n\\n'+
    'Seu plano vence '+quando+' ('+dataBr(assinatura.valido_ate)+'). Deseja renovar?\\n\\n'+
    'Responda:\\n1 - Renovar o plano atual\\n2 - Ver outros planos / fazer upgrade\\n3 - Agora não';

  const ok=await enviarTexto(loja.id,loja.numero_dono_whatsapp,texto);
  if(!ok){await desfazerAviso(reserva);return false;}

  const {data:sessao}=await supabase.from('renovacao_sessoes').select('*').eq('loja_id',loja.id).maybeSingle();
  if(!sessao || ['concluido','adiado'].includes(sessao.estado)){
    await salvarSessao(loja.id,{
      assinatura_id:assinatura.id,
      numero_dono:digitos(loja.numero_dono_whatsapp),
      estado:'aguardando_decisao',
      plano_selecionado:null,duracao_meses:null,provider_qr_id:null,
      expira_em:new Date(Date.now()+14*24*60*60*1000).toISOString()
    });
  }
  return true;
}

function estagioDias(ms){
  const d=Math.ceil(ms/(24*60*60*1000));
  if(d<=0)return 0;
  if(d<=1)return 1;
  if(d<=3)return 3;
  return 7;
}

async function verificarRenovacoes(){
  if(executando)return;
  executando=true;
  try{
    const agora=new Date();
    const limite=new Date(agora.getTime()+7*24*60*60*1000);
    const {data,error}=await supabase.from('assinaturas')
      .select('id,loja_id,plano,status,valido_ate')
      .eq('status','ativo').not('valido_ate','is',null)
      .gte('valido_ate',agora.toISOString()).lte('valido_ate',limite.toISOString());
    if(error)throw error;
    for(const a of (data||[])){
      const validade=new Date(a.valido_ate);
      if(Number.isNaN(validade.getTime()))continue;
      const dias=estagioDias(validade.getTime()-agora.getTime());
      try{await avisarAssinatura(a,dias);}catch(e){console.error('[renovacao] aviso falhou',e?.name||'erro');}
    }
  }catch(e){console.error('[renovacao] varredura falhou',e?.name||'erro');}
  finally{executando=false;}
}

async function contextoDono(evento){
  const {data:cfg,error}=await supabase.from('whatsapp_configuracoes')
    .select('loja_id,identificador_externo,provedor,ativo')
    .eq('identificador_externo',evento.destinatarioId).eq('provedor','waha').eq('ativo',true)
    .limit(1).maybeSingle();
  if(error||!cfg)return null;
  const {data:loja,error:el}=await supabase.from('lojas')
    .select('id,nome,numero_dono_whatsapp').eq('id',cfg.loja_id).maybeSingle();
  if(el||!loja?.numero_dono_whatsapp||!contatoConfere(evento.contato,loja.numero_dono_whatsapp))return null;
  const {data:sessao,error:es}=await supabase.from('renovacao_sessoes').select('*').eq('loja_id',loja.id).maybeSingle();
  if(es||!sessao||['concluido'].includes(sessao.estado))return null;
  if(sessao.expira_em && new Date(sessao.expira_em).getTime()<Date.now())return null;
  return {loja,sessao};
}

async function assinaturaDaSessao(ctx){
  if(ctx.sessao.assinatura_id){
    const {data}=await supabase.from('assinaturas').select('*').eq('id',ctx.sessao.assinatura_id).maybeSingle();
    if(data)return data;
  }
  const {data}=await supabase.from('assinaturas').select('*').eq('loja_id',ctx.loja.id)
    .order('criado_em',{ascending:false}).limit(1).maybeSingle();
  return data||null;
}

async function pedirDuracao(ctx,plano){
  await salvarSessao(ctx.loja.id,{
    estado:'aguardando_duracao',plano_selecionado:plano.codigo,
    numero_dono:digitos(ctx.loja.numero_dono_whatsapp),
    expira_em:new Date(Date.now()+14*24*60*60*1000).toISOString()
  });
  return enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,
    'Plano selecionado: '+plano.nome+' ('+moeda(plano.precoMensalCentavos)+'/mês).\\n\\n'+
    'Escolha a duração respondendo 1, 3, 6 ou 12 meses.'
  );
}

async function gerarPixRenovacao(ctx,duracao){
  const plano=planosVendaveis().find(p=>p.codigo===ctx.sessao.plano_selecionado);
  if(!plano){
    await salvarSessao(ctx.loja.id,{estado:'aguardando_plano'});
    await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Escolha um plano:\\n'+textoPlanos());
    return true;
  }
  const {criarPixPlano}=require('./asaas.service');
  const pix=await criarPixPlano({lojaId:ctx.loja.id,planoCodigo:plano.codigo,duracaoMeses:duracao});
  await salvarSessao(ctx.loja.id,{
    estado:'aguardando_pagamento',duracao_meses:duracao,
    provider_qr_id:pix.provider_qr_id,
    expira_em:new Date(Date.now()+24*60*60*1000).toISOString()
  });
  const valor=moeda(pix.valor_centavos);
  await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,
    'Pix SaintsAI gerado para '+plano.nome+' · '+duracao+' mês(es) · '+valor+'.\\n\\n'+
    'PIX COPIA E COLA:\\n'+pix.pix_copia_cola+'\\n\\n'+
    'Assim que o Asaas confirmar o pagamento, seu plano será atualizado automaticamente.'
  );
  return true;
}

async function processarMensagemDono(evento){
  const ctx=await contextoDono(evento);
  if(!ctx)return false;
  const texto=String(evento.texto||'').trim().toLowerCase();

  if(ctx.sessao.estado==='adiado'){
    if(!/(renov|plano|pagar|pix)/i.test(texto))return false;
    await salvarSessao(ctx.loja.id,{estado:'aguardando_decisao'});
    await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,
      'Claro. Responda 1 para renovar o plano atual ou 2 para ver todos os planos.'
    );
    return true;
  }

  if(ctx.sessao.estado==='aguardando_decisao'){
    if(texto==='3'||texto.includes('agora não')||texto.includes('depois')){
      await salvarSessao(ctx.loja.id,{estado:'adiado'});
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Tudo bem. Eu aviso novamente mais perto do vencimento.');
      return true;
    }
    if(texto==='2'||texto.includes('plano')||texto.includes('upgrade')){
      await salvarSessao(ctx.loja.id,{estado:'aguardando_plano'});
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Planos disponíveis:\\n'+textoPlanos()+'\\n\\nResponda com o número do plano.');
      return true;
    }
    if(texto==='1'||texto.includes('renov')||texto.includes('sim')){
      const a=await assinaturaDaSessao(ctx);
      const plano=planosVendaveis().find(p=>p.codigo===a?.plano);
      if(plano)return pedirDuracao(ctx,plano);
      await salvarSessao(ctx.loja.id,{estado:'aguardando_plano'});
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Escolha um plano:\\n'+textoPlanos());
      return true;
    }
    await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Responda 1 para renovar, 2 para ver planos ou 3 para decidir depois.');
    return true;
  }

  if(ctx.sessao.estado==='aguardando_plano'){
    const plano=acharPlano(texto);
    if(!plano){
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Não reconheci o plano. Escolha:\\n'+textoPlanos());
      return true;
    }
    return pedirDuracao(ctx,plano);
  }

  if(ctx.sessao.estado==='aguardando_duracao'){
    const d=acharDuracao(texto);
    if(!d){
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Escolha a duração: 1, 3, 6 ou 12 meses.');
      return true;
    }
    try{return await gerarPixRenovacao(ctx,d);}
    catch(e){
      console.error('[renovacao] pix falhou',e?.name||'erro');
      await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Não consegui gerar o Pix agora. Tente novamente daqui a pouco.');
      return true;
    }
  }

  if(ctx.sessao.estado==='aguardando_pagamento'){
    if(texto.includes('novo pix')||texto.includes('gerar')||texto.includes('reenviar')){
      try{return await gerarPixRenovacao(ctx,ctx.sessao.duracao_meses||1);}
      catch(_){await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,'Ainda não consegui gerar um novo Pix. Tente novamente daqui a pouco.');return true;}
    }
    await enviarTexto(ctx.loja.id,ctx.loja.numero_dono_whatsapp,
      'O pagamento ainda não foi confirmado. Assim que o Asaas confirmar, eu atualizo o plano automaticamente. Se o Pix expirou, responda NOVO PIX.'
    );
    return true;
  }
  return false;
}

async function confirmarPagamento(lojaId,plano){
  const {data:sessao}=await supabase.from('renovacao_sessoes').select('*').eq('loja_id',lojaId).maybeSingle();
  if(!sessao||sessao.estado!=='aguardando_pagamento')return false;
  const {data:loja}=await supabase.from('lojas').select('numero_dono_whatsapp').eq('id',lojaId).maybeSingle();
  await salvarSessao(lojaId,{estado:'concluido',expira_em:null});
  if(loja?.numero_dono_whatsapp){
    await enviarTexto(lojaId,loja.numero_dono_whatsapp,
      'Pagamento confirmado ✅ Seu plano '+String(plano||'SaintsAI')+' foi atualizado com sucesso.'
    );
  }
  return true;
}

function iniciarAgendadorRenovacao(){
  if(timer)return;
  setTimeout(()=>verificarRenovacoes().catch(()=>{}),15000);
  timer=setInterval(()=>verificarRenovacoes().catch(()=>{}),INTERVALO_MS);
  if(timer.unref)timer.unref();
  console.log('[renovacao] agendador iniciado');
}

module.exports={verificarRenovacoes,processarMensagemDono,confirmarPagamento,iniciarAgendadorRenovacao};
`);

// ---------- Intercepta conversa do dono antes da IA comum ----------
let wc=read('src/controllers/whatsappWahaWebhook.controller.js');
if(!wc.includes("require('../services/renovacao.service')")){
  wc=wc.replace(
    "const idempotenciaService = require('../services/whatsappIdempotencia.service');",
    "const idempotenciaService = require('../services/whatsappIdempotencia.service');\nconst renovacaoService = require('../services/renovacao.service');"
  );
  wc=wc.replace(
    "if(!reservou) return res.status(200).json({status:'duplicado_ignorado'});",
    "if(!reservou) return res.status(200).json({status:'duplicado_ignorado'});\n\n    const renovacaoTratada = await renovacaoService.processarMensagemDono(evento);\n    if(renovacaoTratada) return res.status(200).json({status:'renovacao_processada'});"
  );
}
write('src/controllers/whatsappWahaWebhook.controller.js',wc);

// ---------- Inicia varredura no backend ----------
let app=read('src/app.js');
if(!app.includes("const renovacaoService = require('./services/renovacao.service');")){
  app=app.replace(
    "const whatsappWahaWebhookRoutes = require('./routes/whatsappWahaWebhook.routes');",
    "const whatsappWahaWebhookRoutes = require('./routes/whatsappWahaWebhook.routes');\nconst renovacaoService = require('./services/renovacao.service');"
  );
}
if(!app.includes('renovacaoService.iniciarAgendadorRenovacao()')){
  app=app.replace(
    "app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);",
    "app.use('/api/webhooks/waha', whatsappWahaWebhookRoutes);\nrenovacaoService.iniciarAgendadorRenovacao();"
  );
}
write('src/app.js',app);

// ---------- Renovação antecipada estende a validade atual ----------
let asaas=read('src/services/asaas.service.js');
asaas=asaas.replace(
`async function ativarPlano({ lojaId, plano, assinaturaId = null, providerStatus, duracaoMeses = null }) {
  return definirAssinatura(lojaId, {
    plano,
    status: 'ativo',
    valido_ate: duracaoMeses ? validadePorMeses(duracaoMeses) : null,
    provedor_pagamento: 'asaas',
    provider_assinatura_id: assinaturaId,
    provider_status: providerStatus || null,
  });
}`,
`async function ativarPlano({ lojaId, plano, assinaturaId = null, providerStatus, duracaoMeses = null }) {
  let validoAte = null;
  if (duracaoMeses) {
    const atual = await buscarAssinaturaAtual(lojaId);
    const agora = new Date();
    const atualValido = atual?.valido_ate ? new Date(atual.valido_ate) : null;
    const base = atualValido && !Number.isNaN(atualValido.getTime()) && atualValido > agora ? atualValido : agora;
    validoAte = validadePorMeses(duracaoMeses, base);
  }
  return definirAssinatura(lojaId, {
    plano,
    status: 'ativo',
    valido_ate: validoAte,
    provedor_pagamento: 'asaas',
    provider_assinatura_id: assinaturaId,
    provider_status: providerStatus || null,
  });
}`
);

asaas=asaas.replace(
`        duracaoMeses: pixQrCodeId ? refDados.meses : null
      });
      return { atualizado: true, assinatura };`,
`        duracaoMeses: pixQrCodeId ? refDados.meses : null
      });
      if (pixQrCodeId) {
        try { await require('./renovacao.service').confirmarPagamento(cobranca.loja_id, cobranca.plano); }
        catch (e) { console.error('[renovacao] confirmação pós-pagamento falhou', e?.name || 'erro'); }
      }
      return { atualizado: true, assinatura };`
);
write('src/services/asaas.service.js',asaas);

console.log('Renovação automática pelo número do dono aplicada.');
