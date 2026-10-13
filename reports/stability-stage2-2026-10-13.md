# SaintsAI — etapa 2: recuperação conservadora e triagem

Entrega na mesma PR de rascunho nº 15. Produção, banco, pagamentos e os 133 eventos antigos permanecem sem alteração.

## Código implementado

O worker principal agora grava `envio_em_andamento` e a resposta na fila antes de chamar voz ou envio. Essa gravação usa compare-and-swap sobre ID, estado, número de tentativa, lease e último erro. Um worker com lease vencida ou substituída não recebe autorização para enviar. Duas execuções disputando o mesmo job não conseguem gravar duas intenções.

Ao recuperar um job com intenção ainda pendente, o worker marca `falhou`/`envio_incerto` para revisão. Timeout ou falha depois da intenção também seguem para revisão, sem reenvio automático. Uma entrega confirmada continua usando a finalização sem novo envio implementada na etapa 1. Há nova verificação de controle humano após gravar a intenção e antes da chamada externa.

São usados campos já existentes; não foi executada migração. A estratégia prefere deixar uma mensagem incerta para conferência a duplicá-la. Uma queda entre a intenção e a chamada ao provedor pode separar para revisão uma mensagem que nem chegou a sair. Não há reconciliação automática com recibos do WAHA/Meta nesta entrega.

Este controle cobre o worker principal. Caminhos especiais de áudio/demonstração, serialização entre jobs diferentes da mesma conversa e controle humano de todas as lojas ainda precisam de implementação/revisão. A intenção persistida não equivale a uma confirmação do provedor.

## Triagem e testes

- Atualizados os mocks dos testes de transferência humana para carregar o controle por asterisco real e reconhecer a assinatura atual de `canSend(job,resposta)`.
- Atualizados os mocks do worker híbrido para simular controle humano, intenção de envio e a gravação comercial após uma recusa. As verificações de envio único, silêncio, imagem e recusa foram preservadas.
- Adicionados seis testes da fila: enqueue pendente, deadline durável de 60 segundos, claim configurado, finalização com resposta preservada, tentativas esgotadas e retry anterior ao envio.
- Adicionados sete testes da intenção: disputa concorrente, lease vencida/substituída, erro do banco, recuperação incerta, quarentena por worker obsoleto e finalização de job confirmado.
- Adicionados quatro cenários ao teste do worker: intenção recuperada, erro do provedor depois da intenção, lease perdida e intervenção humana após a intenção.

Suite focada no worktree reconstruído: **68 testes passaram, zero falhas**. Usa banco/provedores simulados; nenhum terceiro recebeu mensagens. A suite ampla foi executada novamente: **1.243 testes, 1.077 passaram e 166 falharam**. O número de falhas caiu de 177 para 166; a triagem integral continua pendente. Não foram apagados testes antigos nem afirmado que todas as falhas restantes são irrelevantes.

O Dockerfile passou a aplicar os dois patches de estabilidade e executar a suite focada ampliada. A validação Docker desta etapa será registrada pela CI da PR; a execução da etapa 1 não certifica este novo código.

## Pendências para publicação

Validar a gravação atômica e recuperação em Postgres isolado, integrar uma visualização/ação de revisão segura para `envio_incerto`, reconciliar recibos do provedor sem reenvio cego, revisar os caminhos que pulam a fila, serializar jobs por conversa, generalizar controle humano, continuar as 166 falhas, validar interfaces e executar staging. Nenhum novo APK ou deploy de produção foi feito nesta etapa.
