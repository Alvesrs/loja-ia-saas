const fs=require('node:fs');
const p='src/services/llm.service.js';
let s=fs.readFileSync(p,'utf8');

const alvo=`    if (!resposta.ok) {
      let corpoErro = '';
      try {
        corpoErro = await resposta.text();
      } catch {
        // ignora falha ao ler corpo do erro; já logamos o status abaixo
      }
      console.error(
        '[llm.service] provedor de LLM retornou erro',
        resposta.status,
        redigirSegredo(corpoErro, config.apiKey)
      );
      throw new ErroLlmProvedor('O provedor de LLM retornou um erro.');
    }`;

const novo=`    if (resposta.status === 429) {
      const retryAfterHeader = Number(resposta.headers && resposta.headers.get && resposta.headers.get('retry-after'));
      let esperaMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? Math.ceil(retryAfterHeader * 1000)
        : 7000;
      esperaMs = Math.max(1000, Math.min(esperaMs, 8000));

      console.warn('[llm.service] limite temporário do provedor atingido; tentando novamente uma vez.');
      await new Promise((resolve) => setTimeout(resolve, esperaMs));

      resposta = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${config.apiKey}\`,
        },
        body: JSON.stringify(corpoRequisicao),
        signal: controller.signal,
      });
    }

    if (!resposta.ok) {
      let corpoErro = '';
      try {
        corpoErro = await resposta.text();
      } catch {
        // ignora falha ao ler corpo do erro; já logamos o status abaixo
      }
      console.error(
        '[llm.service] provedor de LLM retornou erro',
        resposta.status,
        redigirSegredo(corpoErro, config.apiKey)
      );
      throw new ErroLlmProvedor('O provedor de LLM retornou um erro.');
    }`;

if(!s.includes(alvo)) throw new Error('Bloco de erro HTTP do LLM não encontrado.');
s=s.replace(alvo,novo);
fs.writeFileSync(p,s);
console.log('Retry controlado para rate limit 429 do LLM aplicado.');
