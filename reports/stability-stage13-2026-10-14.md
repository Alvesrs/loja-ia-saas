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
