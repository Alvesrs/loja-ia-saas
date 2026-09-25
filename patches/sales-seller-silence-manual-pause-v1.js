const fs=require('node:fs');
const cp=require('node:child_process');
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}

const atendentePath='src/services/whatsappAtendente.service.js';
let a=read(atendentePath);
if(!a.includes("const supabase = require('../config/supabase');")){
  a=a.replace("const iaService = require('./ia.service');","const iaService = require('./ia.service');\nconst supabase = require('../config/supabase');");
}
const blocoVenda=[
"    const vendaAtiva = await salesSeller.conversaAtiva(lojaId, contato);",
"    resposta = vendaAtiva",
"      ? await salesSeller.responder({ lojaId, contato, pergunta: texto })",
"      : await iaService.responderPergunta(lojaId, texto, historico);"
].join('\n');
const blocoNovo=[
"    const vendaAtiva = await salesSeller.conversaAtiva(lojaId, contato);",
"",
"    if (!vendaAtiva) {",
"      const { data: lojaModo, error: erroModo } = await supabase",
"        .from('lojas')",
"        .select('modo_vendedor_somente')",
"        .eq('id', lojaId)",
"        .maybeSingle();",
"      if (erroModo) throw erroModo;",
"      if (lojaModo && lojaModo.modo_vendedor_somente === true) {",
"        console.log('[salesSeller] silencio_fora_de_conversa_autorizada', contato);",
"        return null;",
"      }",
"    }",
"",
"    resposta = vendaAtiva",
"      ? await salesSeller.responder({ lojaId, contato, pergunta: texto })",
"      : await iaService.responderPergunta(lojaId, texto, historico);",
"",
"    if (vendaAtiva && (resposta === null || resposta === undefined || String(resposta).trim() === '')) {",
"      console.log('[salesSeller] silencio_contexto_nao_comercial', contato);",
"      return null;",
"    }"
].join('\n');
if(!a.includes(blocoVenda)) throw new Error('Bloco de roteamento vendedor/IA não encontrado.');
a=a.replace(blocoVenda,blocoNovo);
write(atendentePath,a);

const workerPath='src/services/whatsappWorker.service.js';
let w=read(workerPath);
let workerPatched=false;
for(const alvo of [
"    const resposta = await atendente.responderMensagemWhatsapp(mensagem);\n",
"  const resposta = await atendente.responderMensagemWhatsapp(mensagem);\n",
"    const resposta = await atendente.responderMensagemWhatsapp(mensagem, contexto);\n",
"  const resposta = await atendente.responderMensagemWhatsapp(mensagem, contexto);\n"
]){
  if(w.includes(alvo)){
    const indent=alvo.startsWith('    ')?'    ':'  ';
    const inserir=alvo+indent+"if (resposta === null || resposta === undefined || String(resposta).trim() === '') {\n"+indent+"  console.log('[whatsapp.worker] resposta_silenciosa', mensagem.contato || mensagem.destinatarioId || '');\n"+indent+"  return null;\n"+indent+"}\n";
    w=w.replace(alvo,inserir);
    workerPatched=true;
    break;
  }
}
if(!workerPatched) throw new Error('Chamada ao atendente no whatsappWorker não encontrada.');
write(workerPath,w);

const sellerPath='src/services/salesSeller.service.js';
let s=read(sellerPath);
if(!s.includes('Se a mensagem não tiver relação com a venda do SaintsAI')){
  s=s.replace("- Não envie mensagens por iniciativa própria; apenas responda a esta conversa autorizada.","- Não envie mensagens por iniciativa própria; apenas responda a esta conversa autorizada.\n- Se a mensagem não tiver relação com a venda do SaintsAI, com uma dúvida sobre o SaintsAI, demonstração, preço, contratação, configuração ou continuidade natural desta conversa comercial, responda EXATAMENTE: [SILENCIO]");
}
const retornoLlm=[
"    return await llmService.gerarResposta({",
"      systemPrompt:SYSTEM_PROMPT,",
"      contexto:historico ? 'Histórico recente desta conversa:\\n'+historico : 'Ainda não há histórico salvo além da abordagem inicial.',",
"      pergunta",
"    });"
].join('\n');
const retornoNovo=[
"    const respostaLlm = await llmService.gerarResposta({",
"      systemPrompt:SYSTEM_PROMPT,",
"      contexto:historico ? 'Histórico recente desta conversa:\\n'+historico : 'Ainda não há histórico salvo além da abordagem inicial.',",
"      pergunta",
"    });",
"    if (texto(respostaLlm).toUpperCase() === '[SILENCIO]') return null;",
"    return respostaLlm;"
].join('\n');
if(s.includes(retornoLlm)) s=s.replace(retornoLlm,retornoNovo);
else if(!s.includes("toUpperCase() === '[SILENCIO]'")) throw new Error('Retorno LLM do salesSeller não encontrado.');
write(sellerPath,s);

const ctrlPath='src/controllers/whatsappWahaWebhook.controller.js';
let c=read(ctrlPath);
const fromMeRe=/  if \(evento\.fromMe === true\) \{[\s\S]*?\n  \}\n\n  const chaveId=\{provedor:'waha',idExterno:evento\.idExterno\};/;
if(!fromMeRe.test(c)) throw new Error('Bloco fromMe do webhook WAHA não encontrado.');
const fromMeNovo=[
"  if (evento.fromMe === true) {",
"    try {",
"      const texto=normalizarTextoVenda(evento.texto);",
"      if (texto === GATILHO_VENDAS) {",
"        await ativarConversaVenda(evento);",
"        console.log('[waha.sales] conversa_ativada', evento.contato);",
"        return res.status(200).json({status:'vendedor_saintsai_ativado'});",
"      }",
"      if (texto === '/parar') {",
"        await desativarConversaVenda(evento);",
"        console.log('[waha.sales] conversa_desativada', evento.contato);",
"        return res.status(200).json({status:'vendedor_saintsai_desativado'});",
"      }",
"      if (typeof conversaVendaAtivaPorSessao === 'function' && await conversaVendaAtivaPorSessao(evento)) {",
"        await desativarConversaVenda(evento);",
"        console.log('[waha.sales] conversa_pausada_intervencao_manual', evento.contato);",
"        return res.status(200).json({status:'vendedor_saintsai_pausado_por_intervencao_manual'});",
"      }",
"      return res.status(200).json({status:'mensagem_propria_ignorada'});",
"    } catch (erro) {",
"      console.error('[waha.sales] erro_gatilho', erro && (erro.stack || erro.message || erro));",
"      return res.status(500).json({erro:'Não foi possível atualizar o modo de vendas.'});",
"    }",
"  }",
"",
"  const chaveId={provedor:'waha',idExterno:evento.idExterno};"
].join('\n');
c=c.replace(fromMeRe,fromMeNovo);
write(ctrlPath,c);

cp.execFileSync(process.execPath,['--check',atendentePath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',workerPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',sellerPath],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check',ctrlPath],{stdio:'inherit'});
console.log('Modo vendedor silencioso aplicado.');