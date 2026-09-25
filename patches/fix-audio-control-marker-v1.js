const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/services/whatsappAtendente.service.js';
let s=fs.readFileSync(p,'utf8');
const old=[
"    if (vendaAtiva && typeof resposta === 'string') {",
"      const controleInterno = resposta.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"      if (/^\\[[A-Z_ -]{3,32}\\]$/.test(controleInterno)) {",
"        console.log('[salesSeller] controle_interno_descartado', contato);",
"        return null;",
"      }",
"    }"
].join('\n');
const neu=[
"    if (vendaAtiva && typeof resposta === 'string') {",
"      const controleInterno = resposta.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"      if (/^\\[[A-Z_ -]{3,32}\\]$/.test(controleInterno)) {",
"        const pedidoAudioControle = /(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave).{0,30}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\\s|$)/i.test(String(texto||'').toLowerCase());",
"        if (pedidoAudioControle) {",
"          console.log('[salesSeller] controle_substituido_por_audio', contato);",
"          resposta = 'Claro. O SaintsAI funciona como um atendente inteligente no WhatsApp da empresa. Ele pode responder dúvidas, consultar informações cadastradas, ajudar com produtos, preços e disponibilidade e manter o atendimento andando mesmo quando a equipe está ocupada. Quando for necessário, uma pessoa da equipe pode assumir a conversa. A proposta é deixar o atendimento mais rápido, natural e organizado.';",
"        } else {",
"          console.log('[salesSeller] controle_interno_descartado', contato);",
"          return null;",
"        }",
"      }",
"    }"
].join('\n');
if(!s.includes(old)) throw new Error('Bloco de controle interno não encontrado');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Pedido de áudio não pode mais ser descartado por marcador interno.');