# SaintsAI — valor líquido de recebimento e controle humano

## Correção candidata

A integração Asaas originalmente encaminhava netValue ao push. O patch de outbox removia o envio imediato e o worker passou a usar agendamento.valor; o valor líquido não era persistido. A correção mantém o preço contratado e persiste o líquido separadamente, após a validação já existente do valor bruto e apenas no evento PAYMENT_RECEIVED.

- Migração candidata adiciona pagamento_valor_liquido nullable, sem backfill. Não aplicada em produção.
- Escrita ativada somente com SAINTSAI_RECEIPT_NET_VALUE=1, depois da migração. Desativada por padrão para compatibilidade com banco antigo.
- Worker usa líquido válido quando disponível; valores ausentes/inválidos preservam o comportamento legado. Essa alternativa não constitui prova de taxas ou extrato financeiro.
- Eventos duplicados não sobrescrevem o líquido. Valor bruto incompatível segue rejeitado.
- Teste do outbox verifica líquido enviado ao dispositivo sem alterar o preço e sem novo envio após conclusão.

## Controle humano

Fixture de abertura agora carrega o módulo real de asterisco quando essa funcionalidade existe. Na etapa anterior continua verificando o contrato antigo; no runtime final exige que mensagem comum não pause, '*' assuma e eco API não altere estado.

## Verificação

- Conjunto local: recebimento, outbox, confirmação de agendamento e abertura humana — 29 testes, 29 aprovados, nenhum ignorado.
- Integração da migração em Postgres isolado adicionada à CI, ainda pendente nessa revisão.
- Varredura anterior aos novos testes de líquido: 1167 testes, 1148 aprovados, 19 falhas. Há fixtures/contratos legados e integração manual pendentes; não se declara aprovação global.
- Execuções 38579064242 e 38579052236 do commit anterior foram aprovadas; isso não aprova automaticamente esta alteração.

## Publicação e backup

Login na conta correta e acesso ao projeto confirmados. Dashboard informa Free Plan sem backups automáticos. Credencial do Postgres não está disponível; variáveis do backend não incluem conexão direta, e seus valores são ocultos pelo OAuth. Nenhum plano pago contratado, senha alterada, migração, merge, publicação, mensagem real de teste, cobrança ou replay de evento antigo executado.
