const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/services/whatsappAtendente.service.js';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('pedido_audio_forcado_atendente')){
  const alvo="    if (vendaAtiva && (resposta === null || resposta === undefined || String(resposta).trim() === '')) {";
  if(!s.includes(alvo)) throw new Error('Ponto de silêncio do atendente não encontrado');
  const bloco=[
"    if (vendaAtiva && (resposta === null || resposta === undefined || String(resposta).trim() === '')) {",
"      const pedidoAudio = /(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave).{0,30}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\\s|$)/i.test(String(texto||'').toLowerCase());",
"      if (pedidoAudio) {",
"        console.log('[salesSeller] pedido_audio_forcado_atendente', contato);",
"        resposta = 'Claro. O SaintsAI funciona como um atendente inteligente no WhatsApp da empresa. Ele pode responder dúvidas, consultar informações cadastradas, ajudar com produtos, preços e disponibilidade e manter o atendimento andando mesmo quando a equipe está ocupada. Quando for necessário, uma pessoa da equipe pode assumir a conversa. A proposta é deixar o atendimento mais rápido, natural e organizado.';",
"      }",
"    }",
"",
alvo
  ].join('\n');
  s=s.replace(alvo,bloco);
}
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Fallback de audio explicito aplicado no atendente.');