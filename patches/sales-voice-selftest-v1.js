const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/server.js';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('[salesVoice.selftest] inicio')){
  s += [
    "",
    "setTimeout(async()=>{",
    "  try{",
    "    const supabase=require('./config/supabase');",
    "    const salesVoice=require('./services/salesVoice.service');",
    "    const contato='266717720743997@lid';",
    "    const session='saintsai_d9244132557c4603986e76897d449ab6';",
    "    const {data:conv,error}=await supabase.from('saintsai_sales_conversations')",
    "      .select('id,ativo,ultimo_audio_em').eq('session_id',session).eq('contato',contato).eq('ativo',true).limit(1).maybeSingle();",
    "    if(error) throw error;",
    "    if(!conv||conv.ultimo_audio_em) return console.log('[salesVoice.selftest] ignorado');",
    "    console.log('[salesVoice.selftest] inicio',contato);",
    "    const textoPedido='Me manda um áudio explicando por favor';",
    "    const resposta='Claro. O SaintsAI funciona como um atendente inteligente no WhatsApp da empresa. Ele responde dúvidas, ajuda com produtos, preços e disponibilidade e mantém o atendimento andando quando a equipe está ocupada. Quando for necessário, uma pessoa da equipe pode assumir a conversa. A ideia é deixar o atendimento rápido, natural e organizado.';",
    "    const r=await salesVoice.enviarSeAplicavel({texto:textoPedido,contato},{resposta},{provedor:'waha',destinatarioId:session});",
    "    console.log('[salesVoice.selftest] resultado',r&&r.enviado?'enviado':String(r&&r.motivo||'nao'));",
    "  }catch(e){console.error('[salesVoice.selftest] erro',e&&e.message||e);}",
    "},2500);",
    ""
  ].join('\n');
}
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Self-test de voz SaintsAI aplicado.');
