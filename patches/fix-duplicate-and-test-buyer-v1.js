const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

// 1) Remove processamento direto dos webhooks. A fila/worker é a única responsável.
for(const p of ['src/controllers/whatsappWahaWebhook.controller.js','src/controllers/whatsappWebhook.controller.js']){
  if(!fs.existsSync(p)) continue;
  let s=read(p);
  const antes=s;
  s=s.replace(/\n\s*await\s+workerService\.processarJob\(job\);/g,'');
  s=s.replace(/\n\s*await\s+worker\.processarJob\(job\);/g,'');
  if(s!==antes){
    write(p,s);
    console.log('[dedupe] processamento direto removido de '+p);
  }
}

// 2) Comprador fictício dedicado para a loja Meta de teste.
write('src/services/salesTestBuyer.service.js', [
"const llmService=require('./llm.service');",
"",
"const PROMPT=[",
"  'Você representa a Casa Serena Colchões, uma empresa fictícia criada exclusivamente para testar o vendedor SaintsAI.',",
"  'Você está conversando com alguém que tenta vender o SaintsAI para sua empresa.',",
"  'Responda como um potencial cliente real: natural, breve, coerente e curioso.',",
"  'Nunca aja como atendente de catálogo para consumidor final.',",
"  'Nunca diga que não encontrou produto no catálogo.',",
"  'Faça perguntas úteis sobre preço, implantação, segurança, número atual, estoque, atendimento humano e erros da IA.',",
"  'Se as respostas fizerem sentido, avance gradualmente até demonstrar interesse, pedir demonstração e eventualmente querer contratar.',",
"  'Informações da empresa: pequena loja de colchões; 35 a 60 conversas/dia; dificuldade com demora nas respostas; equipe de 4 pessoas; vende colchões, bases e travesseiros; atende de segunda a sexta 9h-18h e sábado 9h-13h.',",
"  'Não invente dados fora desse contexto. Responda em português do Brasil e faça no máximo uma pergunta principal por mensagem.'",
"].join('\\n');",
"",
"function txt(v){return String(v||'').trim()}",
"",
"function fallback(pergunta){",
"  const p=txt(pergunta).toLowerCase();",
"  if(/preço|preco|valor|mensalidade|quanto custa/.test(p)) return 'Entendi. O valor é uma das coisas que eu preciso avaliar aqui. Além da mensalidade, existe alguma taxa de implantação ou outro custo para começar?';",
"  if(/humano|equipe|assumir|transfer|encaminh/.test(p)) return 'Isso é importante para mim. Se minha equipe quiser assumir uma conversa no meio do atendimento, ela consegue fazer isso normalmente sem a IA continuar atrapalhando?';",
"  if(/número|numero|whatsapp|computador|pc|celular/.test(p)) return 'Certo. E eu consigo usar o número de WhatsApp que já usamos hoje ou teria que trocar de número ou deixar algum computador ligado?';",
"  if(/estoque|catálogo|catalogo|produto|preço|preco/.test(p)) return 'Entendi. Nosso estoque muda bastante, então isso me preocupa. Quando uma informação não estiver cadastrada ou estiver desatualizada, como o SaintsAI evita passar algo errado para o cliente?';",
"  if(/demonstra|demo|mostrar|teste/.test(p)) return 'Pode mostrar sim. Quero ver principalmente como ele responde quando não sabe alguma coisa e como minha equipe assume a conversa quando precisar.';",
"  if(/contrat|assinar|fechar|começar|comecar/.test(p)) return 'Gostei da ideia. Antes de fechar, quero entender certinho como funciona a implantação e o que vocês precisam da minha empresa para configurar o agente.';",
"  return 'Entendi. Minha maior preocupação é não deixar o atendimento com cara de robô nem correr o risco de passar uma informação errada. Como vocês controlam isso no SaintsAI?';",
"}",
"",
"async function responder(pergunta,historico=[]){",
"  if(!llmService.estaConfigurado()) return fallback(pergunta);",
"  try{",
"    const r=await llmService.gerarResposta({systemPrompt:PROMPT,contexto:'Conversa comercial de teste do SaintsAI.',pergunta,historico:Array.isArray(historico)?historico.slice(-12):[]});",
"    return txt(r)||fallback(pergunta);",
"  }catch(e){",
"    console.error('[salesTestBuyer] LLM indisponível; fallback comprador fictício. Tipo:',(e&&e.name)||'desconhecido');",
"    return fallback(pergunta);",
"  }",
"}",
"module.exports={responder,PROMPT};"
].join('\n'));

// 3) A loja Meta de teste nunca passa pelo fallback comum de catálogo.
const ia='src/services/ia.service.js';
let s=read(ia);
if(!s.includes("const salesTestBuyer = require('./salesTestBuyer.service');")){
  const firstRequire=s.match(/^const .*require\([^\n]+\);/m);
  if(!firstRequire) throw new Error('Não encontrei ponto para importar salesTestBuyer em ia.service.js');
  s=s.replace(firstRequire[0],firstRequire[0]+"\nconst salesTestBuyer = require('./salesTestBuyer.service');");
}
if(!s.includes("57d44ea2-d7c3-49d2-aa9a-02595a56f9ce")){
  s=s.replace(
    /async function responderPergunta\(lojaId, pergunta, historico = \[\]\) \{/,
    "async function responderPergunta(lojaId, pergunta, historico = []) {\n  if (lojaId === '57d44ea2-d7c3-49d2-aa9a-02595a56f9ce') {\n    return salesTestBuyer.responder(pergunta, historico);\n  }"
  );
}
write(ia,s);

for(const p of ['src/controllers/whatsappWahaWebhook.controller.js','src/controllers/whatsappWebhook.controller.js','src/services/salesTestBuyer.service.js','src/services/ia.service.js']){
  if(fs.existsSync(p)) cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
}
console.log('Correção final: fila única + comprador fictício sem fallback de catálogo.');