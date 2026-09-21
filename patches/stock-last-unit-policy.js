const fs = require('node:fs');

function patchFile(path, replacers) {
  let src = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacers) {
    if (!src.includes(from)) throw new Error(`Trecho esperado não encontrado em ${path}`);
    src = src.replace(from, to);
  }
  fs.writeFileSync(path, src);
}

patchFile('src/services/iaContexto.service.js', [
  [
`function estaDisponivel(quantidade) {
  return typeof quantidade === 'number' && quantidade > 0;
}`,
`function estaDisponivel(quantidade) {
  return typeof quantidade === 'number' && quantidade > 0;
}

function ehUltimaUnidade(quantidade) {
  return typeof quantidade === 'number' && quantidade === 1;
}`
  ],
  [
`    disponivel: estaDisponivel(variacao.quantidade),
  }));`,
`    disponivel: estaDisponivel(variacao.quantidade),
    ultimaUnidade: ehUltimaUnidade(variacao.quantidade),
  }));`
  ],
  [
`function formatarVariacaoTexto(variacao) {
  return `- ${variacao.cor} / ${variacao.tamanho} → ${variacao.disponivel ? 'disponível' : 'indisponível'}`;
}`,
`function formatarVariacaoTexto(variacao) {
  let status = 'indisponível';
  if (variacao.disponivel) {
    status = variacao.ultimaUnidade ? 'última unidade disponível' : 'disponível';
  }
  return `- ${variacao.cor} / ${variacao.tamanho} → ${status}`;
}`
  ],
  [
`  estaDisponivel,
  ErroLojaInvalida,`,
`  estaDisponivel,
  ehUltimaUnidade,
  ErroLojaInvalida,`
  ]
]);

patchFile('src/services/iaPrompt.service.js', [
  [
`- Quando houver variações de estoque, respeite exatamente "disponível" ou
  "indisponível" informado no contexto.
- Quando o contexto disser que estoque/variações não são controlados no sistema,`,
`- Quando houver variações de estoque, respeite exatamente o status informado no contexto:
  "disponível", "indisponível" ou "última unidade disponível".
- Nunca revele a quantidade exata em estoque ao cliente. A única exceção é quando houver
  exatamente 1 unidade: nesse caso, avise que é a "última unidade".
- Quando o contexto disser que estoque/variações não são controlados no sistema,`
  ]
]);

console.log('Patch de política de estoque aplicado.');
