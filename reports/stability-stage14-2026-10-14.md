# SaintsAI — integridade da montagem final

- CI 38554571997: banco aprovado; montagem final falhou em três testes antigos de PWA/autenticação/navegação.
- Causa verificada nos logs e no Dockerfile: a extração do ZIP substituía os testes atualizados por versões antigas. Não era a mesma suíte executada localmente.
- Dockerfile passa a copiar os testes da branch novamente após o bootstrap. Os testes intermediários continuam executados durante os patches; a verificação final utiliza a versão atual do repositório.
- Teste Android passa a verificar a precondição de PIN seguro e registrar o XML da tela no momento da falha. Não há mudança no bloqueio do aplicativo nem remoção do teste.
- Publicação continua pendente de backup confirmado, aprovação do novo CI e investigação das regressões amplas. Produção preservada.
