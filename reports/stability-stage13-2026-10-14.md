# SaintsAI — validação da fronteira comercial e montagem

- Branch de auditoria, sem alteração de produção.
- CI 38550933894: Postgres e Android aprovados; montagem do backend falhou porque o teste de recusa carregava ownerStarControl antes da etapa que cria esse módulo.
- A fixture agora carrega o módulo real quando disponível. A verificação da recusa e do bloqueio humano continua obrigatória em todas as etapas.
- Corrigida classificação indevida de pedidos de fotos/vídeos da festa e relato de compra de moto. A continuidade de conversas comerciais autorizadas permanece preservada.
- Fixture consultiva passa a carregar o controle humano real e verifica comando exclusivo '*'. Expectativas antigas de expiração de conversa autorizada foram alinhadas ao contrato de continuidade já testado.
- Executado localmente no runtime completo: owner-consultative, commercial-boundary, owner-sales-continuity e owner-refusal-send: 51 testes, 51 aprovados.
- O Docker passa a executar também owner-consultative no conjunto final.
- Aprovação do novo CI ainda pendente. A suíte ampla anterior continua com falhas a investigar; não há aprovação global.
- Sem envio externo, cobrança, replay de eventos antigos, migração ou reinício de produção. Backup completo ainda não confirmado.

## Verificação posterior

- CI 38552110173 e 38552098651: banco aprovado; backend bloqueado pela execução antecipada do teste consultivo; Android bloqueado no teste de PIN (interface do sistema não encontrada). Nenhuma aprovação global.
- Restaurado teste consultivo da etapa intermediária; criado stability-owner-consultative para verificar exclusivamente o runtime final. Não se removeu a validação dos dois estágios.
- Runtime final: conjunto consultivo/comercial/recusa/continuidade novamente 51/51.
- Varredura local com globs tests/*.test.cjs e tests/*.test.js: 1138 testes, 1105 aprovados, 33 falhas. Esse comando não equivale à suíte recursiva anterior. Parte das falhas é incompatibilidade de fixtures antigas; a classificação completa permanece pendente.
- Publicação bloqueada: backup não confirmado, nova montagem e PIN ainda não aprovados, regressões amplas pendentes.
