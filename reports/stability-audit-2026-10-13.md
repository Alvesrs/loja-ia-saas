# SaintsAI — auditoria e correção parcial verificadas em 13/10/2026

## Estado da entrega

Branch: `audit/saintsai-stability-20261013`. Esta entrega NÃO certifica a missão completa nem autoriza promoção automática. Produção e dados não foram alterados. Nenhuma mensagem de teste foi enviada, nenhuma cobrança foi criada e os 133 eventos antigos foram preservados.

Base do código: `081ff1a58c76c6e9bae55d2d2460c9d084f5f8b0`.
Ponto conhecido de reversão do backend: deployment Railway `7fe0775a-1c69-4652-97a6-6d808f5dafca`, marcado SUCCESS na inspeção. Não foi criado backup integral do banco nem validada uma restauração.

## Arquitetura efetivamente verificada

| Componente | Evidência e função |
| --- | --- |
| Backend Node.js | Dockerfile extrai `loja-ia-saas-whatsapp-12a.zip`, aplica patches de `railway.json`, instala dependências e inicia `src/server.js`. O diretório src não está na raiz do checkout inicial. |
| Railway backend-prod | Produção, uma réplica sfo, branch main; healthcheck `/api/health/ready` retornou HTTP 200, worker iniciado e configuração ok. |
| Railway mobile-proxy | Deployment SUCCESS; serve como infraestrutura auxiliar de acesso móvel. |
| Railway WAHA | Deployment SUCCESS, imagem `devlikeapro/waha:noweb`, volume persistente `/app/.sessions`; logs do backend indicam WORKING e identidade verificada. Não foi enviado teste ao WhatsApp. |
| Supabase | Projeto ACTIVE_HEALTHY, Postgres 17.6. Todas as tabelas public listadas têm RLS habilitado. |
| Agente/ADM Android | WebView aponta para função `saintsai-proxy` do Supabase; função ativa v10 encaminha ao backend-prod. |
| Cliente Android | WebView aponta para backend-prod `/cliente/`. Manifesto local: 1.2.20, versionCode 35; APK existente em downloads. Não recompilado nesta auditoria. |
| Agente Android | Manifesto local: 1.0.25, versionCode 26; APK existente em downloads. Não recompilado nesta auditoria. |
| Gerenciador de vendas | WebView aponta para backend-prod `/gerenciador-vendas/`; aplicativo e backend independentes presentes no repositório. |
| backend-app | Último deployment FAILED de 01/10; logs mostram falha na preparação Railpack. Os destinos Android verificados usam backend-prod/proxy, portanto não foi comprovada dependência deste serviço antigo. |

Fluxo principal reconstruído: parser e validação do webhook WAHA/Meta → controles comerciais/humanos → reserva de evento e fila durável → `claim_whatsapp_job` → histórico recebido → plano/contexto/IA → verificação antes do envio → envio de texto/voz/mídia → marca ENVIADO → histórico enviado → conclusão da reserva e da fila. Existem caminhos especiais de áudio/demonstração fora desse fluxo que ainda precisam da mesma revisão de atomicidade.

## Achados comprovados

1. Eventos: 133 `processando` (132 WAHA, 1 Meta), 752 concluídos. Os 133 não têm correspondência pelo mesmo provedor/ID externo na fila nem no histórico local. Isso não prova ausência de resposta no WAHA: falta reconciliação do histórico do provedor e análise das chaves sintéticas.
2. Fila na consulta: 200 registros, todos concluídos, sem último erro. Não havia fila pendente/processando naquele instante.
3. Há unicidade por `(provedor,id_externo)` tanto na reserva quanto na fila. O histórico tem índice único para entradas externas; não foi encontrada garantia equivalente para histórico de saída.
4. `claim_whatsapp_job` usa `FOR UPDATE SKIP LOCKED`, incremento de tentativas e lease. Execução negada a anon/authenticated e concedida a service_role. Não há serialização explícita por conversa nem token de fencing visível nessa função.
5. O worker original só atualizava o objeto job para ENVIADO depois de persistir o envio. Falha nessa persistência ou na atualização comercial imediatamente posterior podia seguir para retry de envio, embora o efeito externo já tivesse ocorrido.
6. O comando de controle por asterisco já existia, porém mensagens comuns em conversa ativa ainda sem abertura concluída podiam cair no controle antigo de pausa. A alteração cobre esse caso no vendedor do proprietário. A generalização para atendimento de todas as lojas não foi implementada nesta entrega.
7. SIGTERM aparece junto a trocas de containers/deployments; não foi comprovado crash espontâneo causado por esses sinais. Não foi feito restart ou desativação de serviço.
8. Segurança: advisors indicam 47 tabelas com RLS sem políticas (acesso direto negado por padrão; backend service_role precisa impor isolamento), extensão btree_gist em public e proteção contra senhas vazadas desativada. Não foram abertas políticas permissivas.
9. Performance: 20 chaves estrangeiras sem índice de cobertura e 10 índices classificados como nunca usados. Não foram removidos índices nem aplicada DDL em produção.

Referências dos advisors: [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [índices de FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Código corrigido nesta branch

- `stability-confirmed-send-v1.js`: registra em memória o envio confirmado antes da persistência e preserva `resposta_texto` ao reagendar finalização, inclusive ao esgotar tentativas. Retry desse caminho finaliza sem novo envio.
- Mantém a IA ativa em conversa comercial já ativada antes de terminar a abertura. `*` isolado continua sendo takeover; mensagem contendo asterisco junto de texto não é comando.
- Dockerfile aplica o patch depois da reconstrução legada e executa seis arquivos de regressão focada mais o novo teste antes de concluir o build.
- Workflow novo faz build Docker e análise de sintaxe, sem deploy e sem acesso a dados/segredos de produção.

Limitação material: queda do processo entre o envio externo e a primeira persistência, ou indisponibilidade persistente de todas as gravações, ainda exige ledger de intenção, reconciliação com o provedor e controle de lease/fencing. Esta correção não promete exatamente uma entrega em todos os cenários.

## Testes realmente executados

| Verificação | Resultado |
| --- | --- |
| Suite ampla na primeira reconstrução local | 1.045 testes: 920 passaram, 125 falharam. |
| Suite focada nova no código reconstruído | 35 testes: 35 passaram, 0 falharam. |
| Reconstrução limpa em worktree separado, usando comandos do build Docker, seguida da suite focada | Comandos concluídos; 35 testes passaram. Não equivale a executar uma imagem Docker nem a staging Railway. |
| Suite ampla no worktree limpo com dependências instaladas | 1.226 testes: 1.049 passaram, 177 falharam. O conjunto inclui testes extraídos do ZIP; as contagens diferem por isso e pelo estado reconstruído. |
| HTTP produção | Cliente, configuração, login e painel: 200. Healthcheck: 200. APIs de lojas e exclusão sem autenticação: 401. |
| Concorrência/prospecção | Testes focados existentes passaram para oito slots, claim concorrente, lease de envio incerto sem reenvio, ranking e proteção contra duplicidade. Não houve carga real no banco de produção. |
| Pagamento/recuperação/notificação | Testes com mocks de validação de pagamentos, autenticação/recuperação e retry de notificação passaram. Nenhum Pix real ou e-mail foi emitido. |

As 177 falhas da suite ampla NÃO foram corrigidas nem descartadas. Há contratos antigos que contradizem regras atuais e mocks faltando dependências novas; isso precisa de triagem por teste, junto das falhas reais. Dois testes de interface v7 também falharam na execução focada ampliada (43/45): contagem antiga de requisições não considera a busca de empresa preferida e páginas geradas depois do shell não recebem seu acabamento. Não foi certificada correção global de interface.

## Condições ainda necessárias para publicação

1. Revisar falhas amplas e estabelecer regressão atual completa, sem esconder falhas reais.
2. Implementar ledger de envio e recuperação segura da janela de crash; serialização por conversa, renovação de lease e fencing; revisar caminhos diretos de voz/demo.
3. Reconciliar cada evento antigo com resposta do provedor antes de qualquer reprocessamento; não reenviar por simples idade/status.
4. Generalizar `*` e retomada contextual após 60 segundos para todas as lojas/provedores, com CAS e testes de mudança humana durante geração/envio.
5. Testar isolamento entre lojas por API e banco, integridade de FKs e índices propostos em banco de testes, com backup e restauração demonstrados.
6. Verificação visual dos apps/painel, revisão de conexão/progresso e compilação Android instrumentada. Os APKs existentes não são uma nova versão desta branch.
7. Staging isolado, sem webhooks e workers ligados a produção; testes de agendamento/Pix/handoff completos com dados sintéticos. Testes externos precisam de destinatário especificamente autorizado.
8. Aprovação de uma release concreta após essas verificações. Manter ponto de reversão e observar logs/health após deploy.

Conclusão: entrega de correções específicas testadas e auditoria verificável; SaintsAI ainda não foi certificado estável de ponta a ponta e a produção não recebeu estas mudanças.
