const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/services/salesSeller.service.js';
let s=fs.readFileSync(p,'utf8');

if(!s.includes('function pedidoExplicitoAudioVenda')){
  const alvo="function recusou(pergunta){";
  if(!s.includes(alvo)) throw new Error('Ponto pedidoExplicitoAudioVenda não encontrado');
  s=s.replace(alvo,[
"function pedidoExplicitoAudioVenda(pergunta){",
"  const t=texto(pergunta).toLowerCase();",
"  return /(manda|mande|envia|envie|pode mandar|pode enviar|quero|faz|faça|grava|grave).{0,30}(áudio|audio|voz|mensagem de voz)|^(áudio|audio|voz)(\\s|$)/i.test(t);",
"}",
"",
alvo
  ].join('\n'));
}

const start="async function responder({lojaId,contato,pergunta}){";
if(s.includes(start) && !s.includes('pedido_audio_resposta_forcada')){
  s=s.replace(start,[
start,
"  if (pedidoExplicitoAudioVenda(pergunta)) {",
"    console.log('[salesSeller] pedido_audio_resposta_forcada', contato);",
"    return 'Claro. O SaintsAI funciona como um atendente inteligente dentro do WhatsApp da empresa. Ele pode responder dúvidas, consultar informações cadastradas, ajudar com produtos e preços e manter a conversa andando mesmo quando ninguém da equipe consegue responder na hora. Quando surgir algo que precise de uma pessoa, o atendimento pode ser assumido pela equipe. A ideia é agilizar o contato sem deixar a conversa com cara de robô.';",
"  }"
  ].join('\n'));
}

fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Pedido explícito de áudio agora sempre gera conteúdo falável.');