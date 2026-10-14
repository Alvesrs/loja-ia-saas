# SaintsAI — permissão na abordagem manual

Fechado o caminho de abordagem manual que não exigia registro de permissão do destinatário. O backend valida confirmação explícita e descrição da permissão antes de consultar o provedor; valida a loja do dono e retém a permissão antes de iniciar o envio. Sem persistência confirmada, não envia. Reserva criada nesta tentativa é liberada somente quando nenhum envio ao provedor foi tentado; envios incertos permanecem protegidos contra repetição.

A tela agora coleta essa confirmação, permite cancelar sem enviar, impede múltiplos formulários simultâneos e cancela se a loja mudar durante o preenchimento. As instruções indicam o comando exclusivo '*' e a retomada após 60 segundos. A busca de contatos e o limite configurado de oito conversas permanecem. URL do JavaScript atualizada para invalidar cache antigo.

Migração candidata: coluna JSONB nullable manual_recipient_permission em saintsai_sales_conversations, sem backfill ou alteração de registros existentes. Deve preceder a implantação do código. Não executada em produção.

Verificações locais:

- 21 testes de prospecção manual/automática e permissão passaram, todos com contatos e provedores fictícios.
- Conjunto final de release: 352 testes, todos passaram, nenhum ignorado.
- Cinco migrações candidatas aplicadas duas vezes no banco restaurado isolado: 94 tabelas, 2.218 registros e 421 restrições; todos os valores existentes preservados.
- Novo teste de navegador cobre cancelamento, ausência de envio antes da confirmação, formulário único, mudança de loja e uma requisição fictícia. Verificação em navegador/CI ainda pendente neste registro.
- CI do tema c589fdd: 38602897497 e 38602882322 aprovadas.

Nenhuma mensagem real, cobrança, contratação, publicação, migração de produção, mudança de credencial ou replay de evento antigo realizado. Falhas da suíte histórica continuam explicitadas na etapa 21, sem afirmação de aprovação global.
