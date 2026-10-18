# Gate de qualidade: sites comerciais com fotos reais (Saints Autônomo)

**Status:** preparado no repositório \`Alvesrs/loja-ia-saas\`, porém o gerador que publica as páginas do app **Saints Autônomo** não foi localizado neste repositório. **Este patch sozinho não altera a operação publicada.** Integrar no serviço responsável por gerar e publicar as propostas antes do teste automático em produção.

## Regra obrigatória

1. Pesquisar fontes oficiais do estabelecimento: Instagram, Facebook, Google Maps, cardápio ou site, com nome + cidade para não confundir homônimos.
2. Classificar como \`NAO_APTO_REFERENCIAS\` se houver menos de três fotos reais, diversas e identificadas, sem capa horizontal, sem cores/identidade confirmadas ou sem ramo/canal comercial comprovados.
3. Fotos disponíveis publicamente podem servir de referência visual, **mas não podem ser incorporadas** sem permissão. Enquanto a autorização não existir, \`AGUARDA_AUTORIZACAO\`.
4. Nunca chamar geradores de imagem por IA, nem usar banco de imagem ou foto de outra empresa.
5. A estrutura e a ação de conversão do site devem ser coerentes com o ramo. Lanchonete => cardápio/pedido; tatuagem => portfólio/orçamento ou agendamento.
6. Após a geração, validar as URLs de TODAS as imagens no HTML/CSS. Rejeitar elementos não presentes no manifesto autorizado.
7. Somente após a aprovação explícita do proprietário do estabelecimento e um teste de funcionamento real, liberar publicação/envio de proposta como pronta.

## Como integrar o gate no SERVIÇO DE GERAÇÃO REAL

\`\`\`js
const {
  createCheckedPreview,
  publishChecked,
} = require('./site-proposal-quality/gate.cjs');

// ANTES de chamar modelo IA/gerador de websites:
const result = await createCheckedPreview(candidate, {
  generate: async ({candidate, allowedImages}) =>
    // O modelo recebe SOMENTE os dados verdadeiros e URLs autorizadas;
    // é PROIBIDO acionar imagegen aqui.
    await builder.build({candidate, allowedImages}),
  render: async proposal =>
    await builder.renderHtml(proposal),
});

// Prévia permanece sem aprovação e NÃO pode ser enviada como site pronto.
await savePreviewForReview(result);

// No endpoint de publicação, revalidar evidências e o HTML real:
const approvedProposal = await getExplicitlyApprovedProposal(result.proposal.id);
await publishChecked(candidate, approvedProposal, result.html,
  async ({proposal,html}) => deployWebsite({proposal,html}));
\`\`\`

ATENÇÃO: \`checkCandidate\` é um verificador de **registros de evidência**; flags \`verified:true\` e \`permission:'authorized'\` só devem ser registradas após prova real independente. É necessário também inspecionar mídia efetivamente carregada no navegador e executar testes de pedidos/agendamentos. Nunca adotar confiança automática na classificação ou na autenticidade de foto baseada exclusivamente em metadados declarados.

## Como testar

\`\`\`sh
node --test tests/site-proposal-quality.test.cjs
\`\`\`

## Dados já verificados da infraestrutura
A automação WhatsApp na pasta \`patches/assets/auto-prospect\` faz prospecção de clientes para o SaaS SaintsAI; **não** é o gerador de sites do Saints Autônomo. Não conectar este filtro àquela automação nem alterar produção apenas para simular que o site está corrigido. Quando o código de geração do Saints Autônomo for disponibilizado neste repositório (ou em repositório distinto), inserir o gate nos dois pontos acima e executar E2E. A lista de propostas antigas também precisa ser auditada pelo sistema que as persiste.
