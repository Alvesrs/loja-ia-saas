const supabase=require('../config/supabase');


function env(){
  return {
    enabled:String(process.env.SAINTSAI_TTS_ENABLED||'true').toLowerCase()==='true',
    voice:String(process.env.SAINTSAI_FREE_TTS_VOICE||'pt-BR-FranciscaNeural').trim(),
    wahaBase:String(process.env.WAHA_BASE_URL||'').replace(/\/+$/,''),
    wahaKey:String(process.env.WAHA_API_KEY||'').trim()
  };
}

function texto(v){return String(v||'').trim()}

function pedidoExplicitoDeAudio(pergunta){
  const p=texto(pergunta).toLowerCase();
  return /(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave|mi manda|me manda).{0,35}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\s|$)/i.test(p);
}

function assuntoEstrategico(pergunta,resposta){
  const p=(texto(pergunta)+' '+texto(resposta)).toLowerCase();
  if(texto(resposta).length<120||texto(resposta).length>1200) return false;
  return /(como funciona|funciona|preço|preco|valor|mensalidade|implant|configur|seguran|errad|rob[oô]|humano|equipe|assum|transfer|demonstra|demo|whatsapp|n[uú]mero|estoque|cat[aá]logo|obje[cç][aã]o|medo|receio|d[uú]vida|contrat|fechar)/i.test(p);
}

async function estadoVenda(sessionId,contato){
  const {data,error}=await supabase.from('saintsai_sales_conversations')
    .select('id,ativo,ultimo_audio_em,audio_divulgado')
    .eq('session_id',sessionId).eq('contato',contato).eq('ativo',true).maybeSingle();
  if(error) throw error;
  return data||null;
}

function cooldownOk(valor){
  if(!valor) return true;
  const t=new Date(valor).getTime();
  return !Number.isFinite(t)||Date.now()-t>=8*60*1000;
}

async function gerarAudio(textoFalado,divulgar){
  const fala=(divulgar?'Sou a assistente virtual do SaintsAI. ':'')+textoFalado;
  return (await require('./chatterboxVoice.service').gerar(fala)).toString('base64');
}

async function enviarWaha(session,contato,data){
  const e=env();
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),45000);
  let r;
  try{
    r=await fetch(e.wahaBase+'/api/sendVoice',{
      method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':e.wahaKey},
      body:JSON.stringify({session,chatId:contato,file:{mimetype:'audio/wav',filename:'saintsai.wav',data},convert:true}),
      signal:ctrl.signal
    });
  }finally{clearTimeout(timer);}
  if(!r.ok){
    let detalhe='';
    try{const j=await r.json();detalhe=String(j&&((j.message)||(j.error&&j.error.message)||j.error)||'').slice(0,180);}catch(_){}
    throw new Error('waha_voice_http_'+r.status+(detalhe?('_'+detalhe):''));
  }
  const receipt=await r.json();
  if(!receipt?.id)throw Error('waha_voice_envio_nao_confirmado');
  return true;
}

async function enviarSeAplicavel(mensagem,resposta,contexto){
  const e=env();
  const pedidoAudio=pedidoExplicitoDeAudio(mensagem&&mensagem.texto);
  if(!e.enabled||!e.wahaBase||!e.wahaKey){
    if(pedidoAudio) console.log('[salesVoice] pedido_audio_sem_tts_configurado',mensagem&&mensagem.contato||'');
    return {enviado:false,motivo:'indisponivel'};
  }
  if(!contexto||contexto.provedor!=='waha') return {enviado:false,motivo:'provedor'};
  if(!pedidoAudio) return {enviado:false,motivo:'nao_estrategico'};
  const est=await estadoVenda(contexto.destinatarioId,mensagem.contato);
  if(!est) return {enviado:false,motivo:'sem_conversa'};
  if(!pedidoAudio && est.audio_divulgado===true) return {enviado:false,motivo:'voz_automatica_ja_usada'};
  if(!pedidoAudio && !cooldownOk(est.ultimo_audio_em)) return {enviado:false,motivo:'cooldown'};
  try{
    console.log('[salesVoice] chatterbox_gerando',mensagem.contato,'Chatterbox PT-BR');
    const data=await gerarAudio(texto(resposta&&resposta.resposta),!est.audio_divulgado);
    console.log('[salesVoice] chatterbox_pronto',mensagem.contato);
    await enviarWaha(contexto.destinatarioId,mensagem.contato,data);
    await supabase.from('saintsai_sales_conversations').update({ultimo_audio_em:new Date().toISOString(),audio_divulgado:true,atualizado_em:new Date().toISOString()}).eq('id',est.id);
    console.log('[salesVoice] audio_enviado',mensagem.contato,pedidoAudio?'pedido_explicito':'estrategico','Chatterbox PT-BR');
    return {enviado:true};
  }catch(erro){
    console.error('[salesVoice] falha_chatterbox_waha',(erro&&erro.message)||'erro');
    return {enviado:false,motivo:'falha'};
  }
}

module.exports={enviarSeAplicavel,assuntoEstrategico,pedidoExplicitoDeAudio,gerarAudio,enviarWaha};