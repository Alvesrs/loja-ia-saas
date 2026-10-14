# SaintsAI — tema e ensaio das migrações sem custo adicional

## Código

Corrigida a inicialização da preferência de tema antes das folhas de estilo. Páginas HTML com head agora recebem o mesmo bootstrap existente; páginas de redirecionamento sem head permanecem no fluxo original. Não foram trocadas funcionalidades ou rotas. Patch repetível incluído no Dockerfile final e teste verifica ordem e ausência de inicialização duplicada.

## Testes realmente executados

- Runtime final local: 345 testes, 345 passaram, nenhum ignorado. Log privado de execução: release-validation-stage21.log.
- Backup: 94 tabelas, 2.218 registros e 421 restrições recuperados e comparados sem divergências.
- Quatro migrações candidatas (batch durável, claim serializado, controle humano e valor líquido) aplicadas duas vezes no banco restaurado isolado. Comparação de todas as colunas originais após as migrações confirmou preservação dos registros. Sem execução em produção.
- Storage: 12 objetos, 5.795.870 bytes recuperáveis a partir do arquivo criptografado; inventário, tamanhos, ETags disponíveis e hashes verificados.
- CI do commit anterior a47559a: execuções 38602097118 e 38602089602 aprovadas. A montagem com o novo patch de tema ainda precisa ser verificada em CI.

## Suíte histórica: limites concretos

A execução anterior de 1.167 testes teve 19 falhas. Sete arquivos não carregavam devido à ausência local de firebase-admin, que o build de produção instala na versão 13.4.0. Instalada a mesma dependência em diretório isolado, a repetição de nove arquivos executou 189 testes: 129 passaram e 60 falharam. Não se declara essa suíte aprovada.

Os testes históricos de webhook/fila usam fixtures anteriores ao processamento durável e exigem contratos antigos (incluindo ausência de novas rotas/importações). Testes de aparência exigem theme.js até em redirecionamentos sem head. O teste antigo de recebimento exige push imediato, substituído pelo outbox e coberto pelos testes atuais. O teste manual exige servidor próprio e não foi usado para enviar mensagens reais. Divergências adicionais de estoque, prospecção e silêncio comercial precisam de revisão individual; a aprovação da suíte de release não substitui essa revisão.

## Publicação

Nenhuma contratação, migração de produção, merge, alteração de credencial, publicação, cobrança, mensagem de teste para terceiros ou replay dos 133 eventos antigos. A entrega continua candidata: testes de release passaram, mas isso não comprova atendimento em produção nem custo zero de execução dos provedores existentes.
