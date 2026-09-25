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

// Reprocessa UMA solicitação recente que ficou presa antes desta correção.
// Isso serve como teste real de ponta a ponta após o deploy, sem exigir nova mensagem do usuário.
const server='src/server.js';
let s=read(server);
if(!s.includes('[salesVoice.test] replay_recente')){
  s += [
    "",
    "setTimeout(async()=>{",
    "  try{",
    "    const supabase=require('./config/supabase');",
    "    const salesVoice=require('./services/salesVoice.service');",
    "    const desde=new Date(Date.now()-2*60*60*1000).toISOString();",
    "    const {data:jobs,error}=await supabase.from('whatsapp_fila_processamento')",
    "      .select('id,destinatario_id,contato,texto,status,criado_em')",
    "      .eq('loja_id','d9244132-557c-4603-986e-76897d449ab6')",
    "      .gte('criado_em',desde).order('criado_em',{ascending:false}).limit(10);",
    "    if(error) throw error;",
    "    const re=/(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave|mi manda|me manda).{0,35}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\\s|$)/i;",
    "    const job=(jobs||[]).find(j=>re.test(String(j.texto||'').toLowerCase()));",
    "    if(!job) return console.log('[salesVoice.test] sem_pedido_recente');",
    "    const {data:conv,error:e2}=await supabase.from('saintsai_sales_conversations')",
    "      .select('id,ativo,ultimo_audio_em').eq('session_id',job.destinatario_id).eq('contato',job.contato).eq('ativo',true).limit(1).maybeSingle();",
    "    if(e2) throw e2;",
    "    if(!conv || conv.ultimo_audio_em) return console.log('[salesVoice.test] replay_desnecessario');",
    "    console.log('[salesVoice.test] replay_recente',job.contato);",
    "    const resposta='Claro. O SaintsAI funciona como um atendente inteligente no WhatsApp da empresa. Ele pode responder dúvidas, consultar informações cadastradas, ajudar com produtos, preços e disponibilidade e manter o atendimento andando mesmo quando a equipe está ocupada. Quando for necessário, uma pessoa da equipe pode assumir a conversa. A proposta é deixar o atendimento mais rápido, natural e organizado.';",
    "    const r=await salesVoice.enviarSeAplicavel({texto:job.texto,contato:job.contato},{resposta},{provedor:'waha',destinatarioId:job.destinatario_id});",
    "    console.log('[salesVoice.test] resultado',r&&r.enviado?'enviado':String(r&&r.motivo||'nao'));",
    "    if(r&&r.enviado){",
    "      await supabase.from('whatsapp_fila_processamento').update({status:'concluido',resposta_texto:'[audio enviado]',ultimo_erro_codigo:null,lease_ate:null,concluido_em:new Date().toISOString(),atualizado_em:new Date().toISOString()}).eq('id',job.id);",
    "    }",
    "  }catch(e){console.error('[salesVoice.test] erro',e&&e.message||e);}",
    "},7000);",
    ""
  ].join('\n');
}
write(server,s);

cp.execFileSync(process.execPath,['--check',controller],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',server],{stdio:'inherit'});
console.log('Áudio explícito agora bypassa fila; replay de teste recente habilitado.');
