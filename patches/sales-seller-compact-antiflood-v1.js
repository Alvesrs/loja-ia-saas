const fs=require('node:fs');
const cp=require('node:child_process');
const p='src/services/salesSeller.service.js';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
"- Seja natural, breve e profissional; evite textos longos.",
"- Seja natural, breve e profissional. REGRA FORTE: responda em no máximo 3 frases curtas e, de preferência, até 350 caracteres."
);
if(!s.includes('- Nunca repita a mesma explicação')){
  s=s.replace(
"- Não repita perguntas que o cliente já respondeu no histórico.",
"- Não repita perguntas que o cliente já respondeu no histórico.\n- Nunca repita a mesma explicação ou praticamente a mesma resposta enviada antes.\n- Se a resposta já tiver sido dada, avance a conversa com uma informação nova ou uma única pergunta curta.\n- Evite listas longas, blocos grandes, introduções repetidas e várias perguntas na mesma mensagem."
  );
}

if(!s.includes('function normalizarComparacao')){
  const alvo="function recusou(pergunta){";
  const helpers=[
"function normalizarComparacao(v){",
"  return texto(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\\s+/g,' ').trim();",
"}",
"",
"function compactarResposta(v){",
"  let r=texto(v).replace(/\\s+/g,' ').trim();",
"  if(!r) return '';",
"  const partes=r.split(/(?<=[.!?])\\s+/).filter(Boolean);",
"  const vistas=new Set();",
"  const unicas=[];",
"  for(const parte of partes){",
"    const n=normalizarComparacao(parte);",
"    if(!n||vistas.has(n)) continue;",
"    vistas.add(n); unicas.push(parte);",
"    if(unicas.length>=3) break;",
"  }",
"  r=(unicas.length?unicas.join(' '):r).trim();",
"  if(r.length>420){",
"    r=r.slice(0,417).replace(/\\s+\\S*$/,'').trim()+'...';",
"  }",
"  return r;",
"}",
"",
"function similaridade(a,b){",
"  const A=new Set(normalizarComparacao(a).split(' ').filter(x=>x.length>2));",
"  const B=new Set(normalizarComparacao(b).split(' ').filter(x=>x.length>2));",
"  if(!A.size||!B.size) return 0;",
"  let inter=0; for(const x of A) if(B.has(x)) inter++;",
"  const uniao=new Set([...A,...B]).size;",
"  return uniao?inter/uniao:0;",
"}",
"",
"async function saidasRecentes(lojaId,contato){",
"  const {data:convs,error:e1}=await supabase.from('whatsapp_conversas')",
"    .select('id').eq('loja_id',lojaId).eq('contato',contato)",
"    .order('atualizado_em',{ascending:false}).limit(1);",
"  if(e1||!Array.isArray(convs)||!convs[0]) return [];",
"  const {data,error}=await supabase.from('whatsapp_mensagens')",
"    .select('texto,criado_em').eq('conversa_id',convs[0].id).eq('loja_id',lojaId).eq('direcao','saida')",
"    .order('criado_em',{ascending:false}).limit(4);",
"  if(error||!Array.isArray(data)) return [];",
"  return data;",
"}",
"",
"async function filtrarAntiFlood(lojaId,contato,resposta){",
"  const r=compactarResposta(resposta);",
"  if(!r) return null;",
"  const saidas=await saidasRecentes(lojaId,contato);",
"  const ultima=saidas[0];",
"  if(ultima&&ultima.criado_em){",
"    const ms=Date.now()-new Date(ultima.criado_em).getTime();",
"    if(Number.isFinite(ms)&&ms>=0&&ms<6000){",
"      console.log('[salesSeller] antiflood_intervalo',contato);",
"      return null;",
"    }",
"  }",
"  for(const ant of saidas.slice(0,3)){",
"    if(similaridade(r,ant.texto)>=0.72){",
"      console.log('[salesSeller] antirepeticao_bloqueada',contato);",
"      return null;",
"    }",
"  }",
"  return r;",
"}",
"",
alvo
  ].join('\n');
  if(!s.includes(alvo)) throw new Error('Ponto helpers não encontrado');
  s=s.replace(alvo,helpers);
}

s=s.replace(
"    return 'O plano básico do SaintsAI começa a partir de R$ 100 por mês. Se você me contar mais ou menos como funciona o atendimento da sua empresa, eu consigo te explicar melhor qual tipo de configuração faria sentido.';",
"    return 'O plano básico do SaintsAI começa em R$ 100 por mês, com implantação única de R$ 100. Como funciona hoje o atendimento de vocês no WhatsApp?';"
);
s=s.replace(
"    return 'O SaintsAI atende pelo WhatsApp usando as informações da própria empresa, podendo responder dúvidas, produtos, preços e disponibilidade cadastrada. A ideia é reduzir o tempo gasto com perguntas repetidas e evitar clientes esperando resposta. Hoje vocês recebem muitas mensagens no WhatsApp?';",
"    return 'O SaintsAI atende no WhatsApp usando as informações da empresa e pode responder dúvidas, produtos, preços e disponibilidade. Hoje vocês recebem muitas mensagens por lá?';"
);
s=s.replace(
"  return 'Posso te mostrar de forma bem prática. O SaintsAI é configurado com as informações da empresa e passa a ajudar no atendimento do WhatsApp. Hoje, qual é a maior dificuldade de vocês com as mensagens dos clientes?';",
"  return 'O SaintsAI ajuda a responder clientes no WhatsApp com as informações da empresa. Qual é a maior dificuldade de vocês hoje no atendimento?';"
);

const oldReturn=[
"    const respostaTexto = texto(respostaLlm);",
"    const marcador = respostaTexto.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"    const somenteControle = /^\\[[A-Z_ -]{3,32}\\]$/.test(marcador);",
"    const pareceSilencio = /SILEN|VILENCI|SILENC|SILENCE/.test(marcador);",
"    if (somenteControle || pareceSilencio) {",
"      console.log('[salesSeller] marcador_interno_bloqueado');",
"      return null;",
"    }",
"    return respostaTexto;"
].join('\n');
const newReturn=[
"    const respostaTexto = texto(respostaLlm);",
"    const marcador = respostaTexto.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase();",
"    const somenteControle = /^\\[[A-Z_ -]{3,32}\\]$/.test(marcador);",
"    const pareceSilencio = /SILEN|VILENCI|SILENC|SILENCE/.test(marcador);",
"    if (somenteControle || pareceSilencio) {",
"      console.log('[salesSeller] marcador_interno_bloqueado');",
"      return null;",
"    }",
"    return await filtrarAntiFlood(lojaId,contato,respostaTexto);"
].join('\n');
if(s.includes(oldReturn)) s=s.replace(oldReturn,newReturn);
else if(!s.includes('filtrarAntiFlood(lojaId,contato,respostaTexto)')) throw new Error('Retorno final do seller não encontrado');

fs.writeFileSync(p,s);
cp.execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
console.log('Vendedor SaintsAI: respostas curtas, anti-repetição e anti-flood aplicados.');
