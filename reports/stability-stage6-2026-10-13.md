# SaintsAI — etapa 6: controle humano por sessão WAHA

Confirmado: ownerMinuteHandoff buscava saintsai_sales_conversations por loja/contato, enquanto ownerStarControl já filtrava também session_id. Essa divergência podia selecionar a conversa de outra conexão ou falhar com vários registros. Não foi demonstrado que causou os incidentes reais relatados.

Correção: incoming, before, canSend, due e recordHuman agora passam a sessão do evento/job à consulta. A consulta exige loja, contato e sessão. Patch aplicado após os anteriores no Dockerfile. Nenhuma migração ou edição de registros reais.

Testes: cinco novos casos falharam antes por ausência de session_id e passaram depois. Suíte focada: 193 aprovados, zero falhas. Uma fixture anterior de prospecção recebeu session_id sintético para representar a conexão efetivamente usada por seu worker. Testes usam consultas simuladas, não tráfego WhatsApp real. Mantidas verificações de 60 segundos, asterisco, retomada, recusa e ausência de reenvio após confirmação.

A etapa 5 também passou na compilação e integração PostgreSQL do GitHub Actions, execução 38479813817. A etapa 6 precisa de sua própria validação CI.

Pendências relevantes encontradas: WAHA agrupa mensagens em memória e pode confirmar antes de persistir o lote; reserva/enqueue não são transação única; caminhos especiais enviam fora do worker; controle humano atual é específico das conversas comerciais do dono, não implementação uniforme em todas as lojas. Essas pendências não foram resolvidas nesta etapa. Não houve deploy, APK novo, reenvio dos 133 eventos ou mensagem a terceiros.
