const fs = require('node:fs');

function replaceOrFail(path, pattern, replacement) {
  let src = fs.readFileSync(path, 'utf8');
  if (!pattern.test(src)) {
    throw new Error('Trecho esperado não encontrado em ' + path);
  }
  src = src.replace(pattern, replacement);
  fs.writeFileSync(path, src);
}

replaceOrFail(
  'src/services/iaContexto.service.js',
  /function estaDisponivel\(quantidade\) \{\n  return typeof quantidade === 'number' && quantidade > 0;\n\}/,
  "function estaDisponivel(quantidade) {\n  return typeof quantidade === 'number' && quantidade > 0;\n}\n\nfunction ehUltimaUnidade(quantidade) {\n  return typeof quantidade === 'number' && quantidade === 1;\n}"
);

replaceOrFail(
  'src/services/iaContexto.service.js',
  /    disponivel: estaDisponivel\(variacao\.quantidade\),\n  \}\)\);/,
  "    disponivel: estaDisponivel(variacao.quantidade),\n    ultimaUnidade: ehUltimaUnidade(variacao.quantidade),\n  }));"
);

replaceOrFail(
  'src/services/iaContexto.service.js',
  /function formatarVariacaoTexto\(variacao\) \{\n  return [^\n]+;\n\}/,
  "function formatarVariacaoTexto(variacao) {\n  let status = 'indisponível';\n  if (variacao.disponivel) {\n    status = variacao.ultimaUnidade ? 'última unidade disponível' : 'disponível';\n  }\n  return '- ' + variacao.cor + ' / ' + variacao.tamanho + ' → ' + status;\n}"
);

replaceOrFail(
  'src/services/iaContexto.service.js',
  /  estaDisponivel,\n  ErroLojaInvalida,/,
  "  estaDisponivel,\n  ehUltimaUnidade,\n  ErroLojaInvalida,"
);

replaceOrFail(
  'src/services/iaPrompt.service.js',
  /- Quando houver variações de estoque, respeite exatamente "disponível" ou\n  "indisponível" informado no contexto\.\n- Quando o contexto disser que estoque\/variações não são controlados no sistema,/,
  "- Quando houver variações de estoque, respeite exatamente o status informado no contexto:\n  \\"disponível\\", \\"indisponível\\" ou \\"última unidade disponível\\".\n- Nunca revele a quantidade exata em estoque ao cliente. A única exceção é quando houver\n  exatamente 1 unidade: nesse caso, avise que é a \\"última unidade\\".\n- Quando o contexto disser que estoque/variações não são controlados no sistema,"
);

console.log('Patch de política de estoque aplicado.');
