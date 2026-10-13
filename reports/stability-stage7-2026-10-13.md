# SaintsAI — etapa 7: agrupamento WAHA persistente (candidato)

Reproduzido: confirmação HTTP 200 acontecia com zero jobs persistidos e temporizador em memória. Novo caminho opcional grava o lote na fila antes do ACK, sem temporizador. Três testes novos falharam antes e passaram depois. Suíte focada local: 196 testes aprovados.

Implementação: WHATSAPP_DURABLE_BATCH=1 ativa o caminho apenas depois de instalar sql/stability/waha-durable-batches.sql. Desativado por padrão; não houve configuração, migração ou deploy real. A função PostgreSQL agrupa mensagens por loja/configuração/sessão/contato, com advisory lock transacional e bloqueio da linha. Só mescla jobs pendentes sem tentativas e ainda dentro da janela. Atualiza o prazo de 10–15 segundos. Preserva cada mensagem em whatsapp_batch_members; o texto agregado é limitado a 12000 caracteres. Jobs em processamento permanecem imutáveis; mensagens novas entram em novo lote. Ao concluir o job, um trigger conclui as reservas de todos os membros.

Segurança: SECURITY INVOKER, search_path vazio, RLS na tabela nova, sem acesso anon/authenticated ou EXECUTE público. Índice do FK job_id. Dados de texto estão no backend protegido; nenhuma informação sensível foi impressa.

Testes PostgreSQL adicionados à CI isolada: agrupamento, conexões novas recuperando o mesmo lote, oito entregas concorrentes, separação de sessões, não alteração de job em processamento, conclusão de todos os membros e rejeição do papel anon. Resultado da CI ainda deve ser confirmado. Não comprovam queda física do servidor nem comportamento do provedor real.

Pendências: reserva do evento ainda precede enqueue em transação separada; queda nesse intervalo pode deixar evento sem job. Não recuperamos automaticamente reservas antigas. Renovação e demonstrações continuam com seus caminhos existentes fora deste agrupamento. Igualdade textual remove variações de caixa/espaço; equivalência de acentos da versão antiga ainda precisa ser preservada. Controle humano uniforme em todas as lojas e serialização durante geração/envio permanecem pendentes. O modo novo NÃO está pronto para ativação em produção antes de validar esquema real, permissões service_role, fallback e esses casos.

Rollback de ativação: voltar WHATSAPP_DURABLE_BATCH para 0 conserva tabela/membros/jobs e retorna entrada ao caminho anterior. Não excluir dados. Conferir jobs já pendentes antes de ativar/desativar.
