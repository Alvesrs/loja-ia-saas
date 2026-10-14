# SaintsAI — auditoria somente leitura e correção de teste em etapas

## Autenticação e permissões

Consultas agregadas pelo conector no projeto ldpiryzsunxwuhyvvogg, sem leitura de senhas, tokens ou dados pessoais individuais, e sem alterações no banco:

- 6 usuários de autenticação; 5 com e-mail confirmado; nenhum banimento ativo. A conta não confirmada não foi modificada.
- 2 lojas, nenhuma vinculada a usuário Auth inexistente. anon/authenticated sem BYPASSRLS; service_role com BYPASSRLS.
- Nenhuma tabela pública sem RLS; 12 políticas registradas. Isso não comprova sozinho isolamento correto nas APIs que usam service_role.
- Advisor: 47 tabelas com RLS sem políticas, nível INFO. O acesso dessas tabelas pelo backend privilegiado precisa ser considerado na auditoria; não se criaram políticas permissivas para remover o aviso.
- Advisor: btree_gist em public, nível WARN. Nenhuma extensão movida.
- Advisor: proteção contra senhas vazadas desativada, nível WARN. Nenhuma configuração de Auth alterada.
- Referências oficiais: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Montagem

- CI 38557850825 e 38557844510: Android/banco passaram; bootstrap falhou no teste de entregas que exigia a interface final antes de ela existir.
- Teste agora distingue a etapa pelo arquivo do pacote final. Antes dele, exige os helpers e sua ordem no formulário legado. Depois dele, exige redirecionamento para a central e não execução do formulário legado. As seis verificações funcionais permanecem.
- Runtime completo local: 7 testes de entregas aprovados. Montagem limpa no novo CI ainda pendente.

## Acesso ao backup

A sessão deste navegador continua na tela de login. O relato de login na outra conversa não foi tratado como prova de sessão compartilhada. Nenhum backup completo ou teste de restauração foi confirmado. Nenhuma publicação, migração, reinício, cobrança, envio externo ou replay de eventos antigos executado.
