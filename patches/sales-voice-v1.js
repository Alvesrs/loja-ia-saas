const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

// Serviço de voz do vendedor SaintsAI: TTS OpenAI -> WAHA sendVoice.
write('src/services/salesVoice.service.js', [
"const supabase=require('../config/supabase');",
"",
"function env(){",
"  return {",
"    enabled:String(process.env.SAINTSAI_TTS_ENABLED||'false').toLowerCase()==='true',",
"    apiKey:String(process.env.OPENAI_API_KEY||'').trim(),",
"    model:String(process.env.SAINTSAI_TTS_MODEL||'gpt-4o-mini-tts').trim(),",
"    voice:String(process.env.SAINTSAI_TTS_VOICE||'onyx').trim(),",
"    base:String(process.env.OPENAI_API_BASE||'https://api.openai.com/v1').replace(/\\/+$/,''),",
"    wahaBase:String(process.env.WAHA_BASE_URL||'').replace(/\\/+$/,''),",
"    wahaKey:String(process.env.WAHA_API_KEY||'').trim()",
"  };",
"}",
"",
"function texto(v){return String(v||'').trim()}",
"",
"function assuntoEstrategico(pergunta,resposta){",
"  const p=(texto(pergunta)+' '+texto(resposta)).toLowerCase();",
"  if(texto(resposta).length<120 || texto(resposta).length>1200) return false;",
"  return /(como funciona|funciona|preço|preco|valor|mensalidade|implant|configur|seguran|errad|rob[oô]|humano|equipe|assum|transfer|demonstra|demo|whatsapp|n[uú]mero|estoque|cat[aá]logo|obje[cç][aã]o|medo|receio|d[uú]vida|contrat|fechar)/i.test(p);",
"}",
"",
"async function estadoVenda(sessionId,contato){",
"  const {data,error}=await supabase.from('saintsai_sales_conversations')",
"    .select('id,ativo,ultimo_audio_em,audio_divulgado')",
"    .eq('session_id',sessionId).eq('contato',contato).eq('ativo',true).maybeSingle();",
"  if(error) throw error;",
"  return data||null;",
"}",
"",
"function cooldownOk(valor){",
"  if(!valor) return true;",
"  const t=new Date(valor).getTime();",
"  return !Number.isFinite(t) || Date.now()-t >= 8*60*1000;",
"}",
"",
"async function gerarAudio(textoFalado,divulgar){",
"  const e=env();",
"  const fala=(divulgar ? 'Só para deixar claro: esta é uma voz gerada por inteligência artificial do SaintsAI. ' : '') + textoFalado;",
"  const r=await fetch(e.base+'/audio/speech',{",
"    method:'POST',",
"    headers:{Authorization:'Bearer '+e.apiKey,'Content-Type':'application/json'},",
"    body:JSON.stringify({",
"      model:e.model,",
"      voice:e.voice,",
"      input:fala.slice(0,4096),",
"      response_format:'mp3',",
"      speed:0.94,",
"      instructions:'Fale em português do Brasil com voz masculina adulta, séria, calma, profissional, confiante e persuasiva. Soe natural e consultivo, nunca agressivo. Use pausas curtas e entonação humana. Não pareça locutor de propaganda.'",
"    })",
"  });",
"  if(!r.ok) throw new Error('tts_http_'+r.status);",
"  const b=Buffer.from(await r.arrayBuffer());",
"  if(!b.length) throw new Error('tts_vazio');",
"  return b.toString('base64');",
"}",
"",
"async function enviarWaha(session,contato,data){",
"  const e=env();",
"  const r=await fetch(e.wahaBase+'/api/sendVoice',{",
"    method:'POST',",
"    headers:{Accept:'application/json','Content-Type':'application/json','X-Api-Key':e.wahaKey},",
"    body:JSON.stringify({session,chatId:contato,file:{mimetype:'audio/mpeg',data},convert:true})",
"  });",
"  if(!r.ok) throw new Error('waha_voice_http_'+r.status);",
"  let j=null; try{j=await r.json();}catch(_){}",
"  return j;",
"}",
"",
"async function enviarSeAplicavel(mensagem,resposta,contexto){",
"  const e=env();",
"  if(!e.enabled || !e.apiKey || !e.wahaBase || !e.wahaKey) return {enviado:false,motivo:'indisponivel'};",
"  if(!contexto || contexto.provedor!=='waha') return {enviado:false,motivo:'provedor'};",
"  if(!assuntoEstrategico(mensagem&&mensagem.texto,resposta&&resposta.resposta)) return {enviado:false,motivo:'nao_estrategico'};",
"  const est=await estadoVenda(contexto.destinatarioId,mensagem.contato);",
"  if(!est || !cooldownOk(est.ultimo_audio_em)) return {enviado:false,motivo:'cooldown'};",
"  try{",
"    const data=await gerarAudio(resposta.resposta,!est.audio_divulgado);",
"    await enviarWaha(contexto.destinatarioId,mensagem.contato,data);",
"    await supabase.from('saintsai_sales_conversations').update({ultimo_audio_em:new Date().toISOString(),audio_divulgado:true,atualizado_em:new Date().toISOString()}).eq('id',est.id);",
"    console.log('[salesVoice] audio_enviado',mensagem.contato);",
"    return {enviado:true};",
"  }catch(erro){",
"    console.error('[salesVoice] falha; usando texto. Tipo:',(erro&&erro.message)||'erro');",
"    return {enviado:false,motivo:'falha'};",
"  }",
"}",
"",
"module.exports={enviarSeAplicavel,assuntoEstrategico};"
].join('\n'));

// Integra no worker com fallback automático para texto.
const worker='src/services/whatsappWorker.service.js';
let w=read(worker);
if(!w.includes("const salesVoice = require('./salesVoice.service');")){
  w=w.replace("const assinaturas = require('./assinaturas.service');","const assinaturas = require('./assinaturas.service');\nconst salesVoice = require('./salesVoice.service');");
}
const alvo="      await envio.enviarRespostaWhatsapp(mensagem, resposta, contexto);";
if(w.includes(alvo) && !w.includes('salesVoice.enviarSeAplicavel')){
  w=w.replace(alvo,[
"      const voz = await salesVoice.enviarSeAplicavel(mensagem, resposta, contexto);",
"      if (!voz.enviado) {",
"        await envio.enviarRespostaWhatsapp(mensagem, resposta, contexto);",
"      }"
  ].join('\n'));
}
write(worker,w);

cp.execFileSync(process.execPath,['--check','src/services/salesVoice.service.js'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',worker],{stdio:'inherit'});
console.log('Voz do vendedor SaintsAI integrada com fallback seguro para texto.');