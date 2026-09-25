const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const controller='src/controllers/whatsappWahaWebhook.controller.js';
let c=read(controller);
if(!c.includes("const salesVoice = require('../services/salesVoice.service');")){
  c=c.replace(
    "const idempotenciaService = require('../services/whatsappIdempotencia.service');",
    "const idempotenciaService = require('../services/whatsappIdempotencia.service');\nconst salesVoice = require('../services/salesVoice.service');"
  );
}
if(!c.includes('function pedidoAudioDireto')){
  c=c.replace(
    "function chaveConversa(evento){",
    [
      "function pedidoAudioDireto(v){",
      "  const t=String(v||'').trim().toLowerCase();",
      "  return /(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave|mi manda|me manda).{0,35}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\\s|$)/i.test(t);",
      "}",
      "",
      "const RESPOSTA_AUDIO_DIRETA='Claro. O SaintsAI funciona como um atendente inteligente no WhatsApp da empresa. Ele pode responder dúvidas, consultar informações cadastradas, ajudar com produtos, preços e disponibilidade e manter o atendimento andando mesmo quando a equipe está ocupada. Quando for necessário, uma pessoa da equipe pode assumir a conversa. A proposta é deixar o atendimento mais rápido, natural e organizado.';",
      "",
      "async function tentarAudioDireto(evento){",
      "  if(!pedidoAudioDireto(evento&&evento.texto)) return false;",
      "  const {data:ativa,error}=await supabase.from('saintsai_sales_conversations')",
      "    .select('id').eq('session_id',evento.destinatarioId).eq('contato',evento.contato).eq('ativo',true).limit(1).maybeSingle();",
      "  if(error) throw error;",
      "  if(!ativa) return false;",
      "  const r=await salesVoice.enviarSeAplicavel(",
      "    {texto:evento.texto,contato:evento.contato},",
      "    {resposta:RESPOSTA_AUDIO_DIRETA},",
      "    {provedor:'waha',destinatarioId:evento.destinatarioId}",
      "  );",
      "  console.log('[salesVoice] audio_direto_webhook',evento.contato,r&&r.enviado?'enviado':String(r&&r.motivo||'nao'));",
      "  return Boolean(r&&r.enviado);",
      "}",
      "",
      "function chaveConversa(evento){"
    ].join('\n')
  );
}

const anchor="  const chaveId={provedor:'waha',idExterno:evento.idExterno};\n  try{";
if(c.includes(anchor) && !c.includes("audio_direto_concluido")){
  c=c.replace(anchor,[
    "  const chaveId={provedor:'waha',idExterno:evento.idExterno};",
    "  try{",
    "    if (pedidoAudioDireto(evento.texto)) {",
    "      const reservouAudio = await idempotenciaService.reservarEventoWhatsapp(chaveId);",
    "      if(!reservouAudio) return res.status(200).json({status:'duplicado_ignorado'});",
    "      const enviadoAudio = await tentarAudioDireto(evento);",
    "      if(enviadoAudio){",
    "        console.log('[salesVoice] audio_direto_concluido',evento.contato);",
    "        return res.status(200).json({status:'audio_enviado'});",
    "      }",
    "      try{await idempotenciaService.liberarEventoWhatsapp(chaveId);}catch(_){ }",
    "    }",
    "    "
  ].join('\n'));
}
write(controller,c);

cp.execFileSync(process.execPath,['--check',controller],{stdio:'inherit'});\nconsole.log('Áudio explícito agora bypassa fila e segue direto para o TTS.');\n