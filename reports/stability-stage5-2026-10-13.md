# SaintsAI — etapa 5: persistência de lotes Meta

O controller Meta confirmava HTTP 200 após enfileirar somente a primeira mensagem válida do lote. A falha foi reproduzida antes da alteração: os cinco novos testes falharam, incluindo três mensagens recebidas com apenas um job persistido.

A correção enfileira sequencialmente cada texto válido usando a reserva idempotente existente. Duplicatas não interrompem o restante do lote. Se um enqueue falha, a resposta é 500 e somente a reserva da mensagem que falhou é liberada; jobs anteriores permanecem reservados. A reentrega ignora os anteriores e tenta os restantes. Nenhum envio é feito pelo controller.

Verificação local: cinco testes novos passaram; suíte focada completa: 188 testes, 188 aprovados. Os testes usam o parser e controller reais com serviços de armazenamento simulados: não comprovam transações de banco nem o envio real ao provedor. Cobrem lote completo, duplicata inicial, falha parcial/reentrega, lote repetido e duas entregas simultâneas.

Patch: patches/stability-meta-batch-v1.js, aplicado após os patches existentes no Dockerfile. Aplicação idempotente com âncoras verificadas. Preserva contrato HTTP de mensagens individuais.

Limites: mudança restrita à rota Meta; não demonstra causa dos silêncios WAHA nem recupera os 133 eventos antigos. Reserva e enqueue continuam operações separadas: queda abrupta entre ambas pode deixar reserva sem job, problema ainda pendente. Serialização de conversa e envio completo pelo webhook/worker exigem validação adicional. Não houve alteração de produção, banco real, envio a terceiros ou atualização de APK.
