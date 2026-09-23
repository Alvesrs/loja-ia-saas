const fs=require('node:fs');

function read(p){return fs.readFileSync(p,'utf8');}
function write(p,s){fs.writeFileSync(p,s);}
function rep(p,a,b){
  let s=read(p);
  if(!s.includes(a)) throw new Error('Trecho não encontrado em '+p+': '+a.slice(0,80));
  s=s.replace(a,b);
  write(p,s);
}

// 1) Memória no LLM: histórico sempre entra como user/assistant, nunca como system.
rep('src/services/llm.service.js',
"function construirMensagens({ systemPrompt, contexto, pergunta }) {",
"function construirMensagens({ systemPrompt, contexto, pergunta, historico = [] }) {"
);

rep('src/services/llm.service.js',
"  mensagens.push({ role: 'system', content: conteudoSistema });\n  mensagens.push({ role: 'user', content: pergunta });",
`  mensagens.push({ role: 'system', content: conteudoSistema });

  const historicoSeguro = Array.isArray(historico)
    ? historico.slice(-12).filter((m) =>
        m && (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' && m.content.trim()
      ).map((m) => ({
        role: m.role,
        content: m.content.trim().slice(0, 1200)
      }))
    : [];

  mensagens.push(...historicoSeguro);
  mensagens.push({ role: 'user', content: pergunta });`
);

rep('src/services/llm.service.js',
"async function gerarResposta({ systemPrompt, contexto, pergunta } = {}) {",
"async function gerarResposta({ systemPrompt, contexto, pergunta, historico = [] } = {}) {"
);

rep('src/services/llm.service.js',
"messages: construirMensagens({ systemPrompt, contexto, pergunta }),",
"messages: construirMensagens({ systemPrompt, contexto, pergunta, historico }),"
);

// 2) Leva o histórico através do prompt/service.
rep('src/services/iaPrompt.service.js',
"function montarEntradaLlm({ contexto, pergunta, promptMestreLoja } = {}) {",
"function montarEntradaLlm({ contexto, pergunta, promptMestreLoja, historico = [] } = {}) {"
);
rep('src/services/iaPrompt.service.js',
"    contexto,\n    pergunta,",
"    contexto,\n    pergunta,\n    historico,"
);

let p=read('src/services/iaPrompt.service.js');
p=p.replace(
`CONVERSA SEM MEMÓRIA
- Responda apenas com base na pergunta atual, no contexto atual e
  nestas instruções. Não presuma informações de conversas anteriores.`,
`MEMÓRIA DA CONVERSA
- Considere as mensagens anteriores da mesma conversa quando elas forem fornecidas.
- Não pergunte novamente algo que o cliente já respondeu.
- Use respostas anteriores para avançar naturalmente para o próximo passo da venda ou atendimento.
- Se o cliente corrigir uma informação anterior, considere a informação mais recente.
- Não invente memória: use somente o histórico realmente recebido nesta conversa.`
);
write('src/services/iaPrompt.service.js',p);

rep('src/services/ia.service.js',
"async function tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja }) {",
"async function tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja, historico = [] }) {"
);
rep('src/services/ia.service.js',
"const entrada = iaPrompt.montarEntradaLlm({ contexto: textoContexto, pergunta, promptMestreLoja });",
"const entrada = iaPrompt.montarEntradaLlm({ contexto: textoContexto, pergunta, promptMestreLoja, historico });"
);
rep('src/services/ia.service.js',
"async function responderPergunta(lojaId, pergunta) {",
"async function responderPergunta(lojaId, pergunta, historico = []) {"
);
rep('src/services/ia.service.js',
"const respostaLlm = await tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja });",
"const respostaLlm = await tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja, historico });"
);

// 3) A rota de teste aceita histórico curto da conversa.
rep('src/controllers/ia.controller.js',
"  const { pergunta } = req.body;",
"  const { pergunta, historico = [] } = req.body;"
);
rep('src/controllers/ia.controller.js',
"    const resposta = await responderPergunta(lojaId, pergunta);",
"    const resposta = await responderPergunta(lojaId, pergunta, Array.isArray(historico) ? historico.slice(-12) : []);"
);

// 4) Teste do app mantém memória durante a conversa atual.
rep('public/js/atendente.js',
"let primeiraMensagemEnviada = false;",
"let primeiraMensagemEnviada = false;\nlet historicoIaTeste = [];"
);
rep('public/js/atendente.js',
"      body: JSON.stringify({ pergunta }),",
"      body: JSON.stringify({ pergunta, historico: historicoIaTeste.slice(-12) }),"
);
rep('public/js/atendente.js',
"    adicionarMensagem(resultado && resultado.resposta ? resultado.resposta : 'Não foi possível obter uma resposta agora. Tente novamente.', 'atendente');",
`    const textoResposta = resultado && resultado.resposta ? resultado.resposta : 'Não foi possível obter uma resposta agora. Tente novamente.';
    adicionarMensagem(textoResposta, 'atendente');
    historicoIaTeste.push({ role: 'user', content: pergunta }, { role: 'assistant', content: textoResposta });
    if (historicoIaTeste.length > 12) historicoIaTeste = historicoIaTeste.slice(-12);`
);

// 5) WhatsApp também usa o histórico real já salvo no banco.
rep('src/services/whatsappAtendente.service.js',
"const iaService = require('./ia.service');",
"const iaService = require('./ia.service');\nconst historicoService = require('./whatsappHistorico.service');"
);
rep('src/services/whatsappAtendente.service.js',
"    resposta = await iaService.responderPergunta(lojaId, texto);",
`    let historico = [];
    try {
      const conversas = await historicoService.listarConversas(lojaId, 50);
      const conversa = conversas.find((c) =>
        c.configuracao_id === mensagem.configuracaoId && c.contato === contato
      );
      if (conversa) {
        const mensagens = await historicoService.listarMensagens(conversa.id, lojaId, 30);
        historico = mensagens.map((m) => ({
          role: m.direcao === 'saida' ? 'assistant' : 'user',
          content: m.texto
        }));
        const ultima = historico[historico.length - 1];
        if (ultima && ultima.role === 'user' && ultima.content.trim() === texto.trim()) historico.pop();
        historico = historico.slice(-12);
      }
    } catch (_) {
      historico = [];
    }
    resposta = await iaService.responderPergunta(lojaId, texto, historico);`
);

// 6) Corrige o progresso: WAHA conectado também conta como WhatsApp pronto.
p=read('public/dashboard.html');
const antigo=`      let waOk = false;
      if (configsR.status === 'fulfilled' && Array.isArray(configsR.value)) {
        const config = configsR.value.find((c) => c.provedor === 'meta' && c.ativo);
        if (config) {
          try {
            const cred = await apiFetch(\`/lojas/\${loja.id}/whatsapp/\${config.id}/credencial\`);
            waOk = Boolean(cred && cred.credencial_configurada);
          } catch (_) { waOk = false; }
        }
      }`;
const novo=`      let waOk = false;
      if (configsR.status === 'fulfilled' && Array.isArray(configsR.value)) {
        const waha = configsR.value.find((c) => c.provedor === 'waha' && c.ativo);
        if (waha) {
          try {
            const st = await apiFetch(\`/lojas/\${loja.id}/whatsapp/waha/status\`);
            waOk = Boolean(st && st.connected === true);
          } catch (_) { waOk = false; }
        }
        if (!waOk) {
          const config = configsR.value.find((c) => c.provedor === 'meta' && c.ativo);
          if (config) {
            try {
              const cred = await apiFetch(\`/lojas/\${loja.id}/whatsapp/\${config.id}/credencial\`);
              waOk = Boolean(cred && cred.credencial_configurada);
            } catch (_) { waOk = false; }
          }
        }
      }`;
if(!p.includes(antigo)) throw new Error('Trecho de prontidão do WhatsApp não encontrado.');
p=p.replace(antigo,novo);
write('public/dashboard.html',p);

// 7) Prompt Mestre: fallback administrativo sem GET quebrado de detalhes.
p=read('public/js/atendente.js');
p=p.replace(
"        const cliente = await apiFetch('/admin/clientes-gerenciados/' + encodeURIComponent(lojaAtualIdChat));",
"        const cliente = await obterLojaAtual();\n        if (!cliente || !cliente.nome) throw new Error('Não foi possível identificar a loja selecionada.');"
);
write('public/js/atendente.js',p);

console.log('Correções de memória da IA, WhatsApp, Prompt Mestre e progresso aplicadas.');
