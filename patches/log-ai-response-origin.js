const fs = require('node:fs');

const path = 'src/services/ia.service.js';
const source = fs.readFileSync(path, 'utf8');

const oldBlock = `  const respostaLlm = await tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja });
  if (respostaLlm !== null) {
    return respostaLlm;
  }

  return montarResposta(produtosBrutos, pergunta);`;

const newBlock = `  const respostaLlm = await tentarResponderComLlm({ textoContexto, pergunta, promptMestreLoja });
  if (respostaLlm !== null) {
    console.log('[ia.service] resposta_origem=llm');
    return respostaLlm;
  }

  console.log('[ia.service] resposta_origem=fallback');
  return montarResposta(produtosBrutos, pergunta);`;

if (!source.includes(oldBlock)) {
  throw new Error('Bloco esperado de ia.service.js não encontrado; patch não aplicado.');
}

fs.writeFileSync(path, source.replace(oldBlock, newBlock));
console.log('Patch de telemetria da origem da IA aplicado.');
