# SaintsAI — revisão para lançamento

Data: 11/10/2026, America/Sao_Paulo. Esta revisão não declara aprovação pela Google Play nem substitui testes com empresas reais.

## Corrigido nesta revisão

- Tabelas de dispositivos de notificação: RLS habilitada e acesso direto de anon/authenticated revogado. Backend service_role mantém as operações necessárias. Verificação SQL confirmou as permissões; nenhuma credencial ou token armazenado foi consultado.
- Login: recuperação de senha e suporte acessíveis; envio duplicado bloqueado.
- Recuperação: redirecionamento fixo, mensagem que não revela existência da conta, token apenas em memória e removido da URL, autenticação pelo Supabase antes de ler amr=recovery, revogação global de sessões e bloqueio de tokens anteriores à troca de senha.
- Primeiro acesso: validação de formulário e bloqueio de submissão duplicada, preservando a troca obrigatória de credenciais temporárias.
- Exclusão: solicitação no app com confirmação explícita, protocolo persistente e consulta no ADM. É um procedimento assistido, não uma exclusão automática. Pedidos repetidos retornam o mesmo protocolo. Contas ainda no primeiro acesso também podem solicitar exclusão.
- Página externa de exclusão: instruções claras e contato direto por e-mail, acessível sem reinstalar ou autenticar no app.
- Política de privacidade: identificação SaintsAI, contato de suporte, mídia, notificações, agendamentos e biometria.
- Cadastro público: senha mínima de 10 caracteres e proteção contra dupla submissão da interface. Não altera senhas existentes.
- Asaas subconta: HTTP 200 somente após processar; falha de persistência retorna erro para permitir nova tentativa. Valor incompatível ou QR diferente não marca o agendamento como pago.
- Notificações de vendas de agendamentos: fila durável criada na mesma transação do pagamento, uma entrada por agendamento, bloqueio por tentativa, recuperação de processamento interrompido e tentativas com intervalo crescente por até 48 horas. Sem dispositivo ativo, a mensagem permanece pendente. Não há promessa de entrega se o usuário desativar notificações ou o provedor não entregar.
- Repetições de notificações com o mesmo agendamento usam a mesma identificação Android, em vez de criar cartões adicionais.
- Android Cliente 1.2.19 / código 34: compile/target SDK 36; assinatura existente preservada.
- Build separado para Play: AAB assinado, sem REQUEST_INSTALL_PACKAGES e sem WRITE_EXTERNAL_STORAGE. Atualização abre Play Store; navegação de compras da assinatura SaintsAI e de APKs é bloqueada. Não contém Play Billing: é uma versão para contas empresariais existentes. Pix de serviços físicos não é bloqueado.
- Entregas continua adormecida e sem acesso dos clientes.

## Evidências locais e banco

- 12 testes de recuperação, exclusão, autenticação de webhook, valor de pagamento e nova tentativa de notificação.
- Quatro cenários DOM: primeiro acesso, recuperação, exclusão e distribuição Play/direta.
- 46 testes de regressão: sessão persistente, upload, galeria, demonstração, Asaas e agenda.
- Interface: início com respostas rápidas, lentas e erro, além de páginas operacionais ativas. A página Entregas foi excluída desse conjunto porque redireciona para o início por decisão do proprietário.
- Build completo das alterações geradas executado; testes obrigatórios de interface e entrega executados na cadeia.
- SQL: fila e proteção contra duplicidade verificadas dentro de transação com ROLLBACK. Nenhum agendamento, venda ou notificação de teste foi persistido ou enviado.
- Supabase Security Advisors: sem avisos de nível ERROR após correção. Permanecem avisos sobre btree_gist no esquema public e proteção contra senhas vazadas desativada. RLS sem políticas nas tabelas internas é intencional: acesso apenas pelo backend.

## Ainda necessário antes de produção pública

1. Validar SMTP de produção e autorizar a URL de recuperação no Supabase. Não foi enviado e-mail real nesta revisão. Sem SMTP configurado e redirecionamento permitido, o código de recuperação não basta para garantir o recebimento. URL: https://backend-prod-production-f338.up.railway.app/cliente/cliente-recuperar.html .
2. Teste real completo com uma nova empresa: compra/cadastro, integração Asaas, WhatsApp, cadastro de serviços/profissionais, agendamento por um consumidor, Pix real, confirmação e notificação com o app fechado. Os testes com mocks não certificam disponibilidade ou aprovação de terceiros.
3. Preparar conta Play Console, identidade do desenvolvedor, ficha da loja, declaração Data safety fiel aos SDKs, classificação indicativa e acesso de revisão sem dados de clientes reais.
4. Se for conta pessoal criada após 13/11/2023: teste fechado com pelo menos 12 testadores inscritos continuamente por 14 dias e pedido de acesso à produção. Cumprir isso não garante aprovação automática.
5. Confirmar a opção comercial: o AAB preparado é para contas existentes. Para vender a assinatura digital dentro do aplicativo, implementar/configurar Play Billing ou comprovar enquadramento em programa/exceção aplicável. O cadastro e a cobrança atuais por Pix continuam no site/APK de distribuição direta.
6. Revisar identificação jurídica, práticas de retenção e procedimento operacional de exclusão com o responsável. A revisão técnica não inventa CNPJ, prazos legais ou identidade jurídica.
7. Realizar testes físicos em diferentes aparelhos, rede ruim, troca de conta e restauração de sessão, e concluir revisão de acessibilidade. Não foi feita inspeção visual de todos os aparelhos nesta revisão.

## Referências oficiais consultadas

- API alvo: https://support.google.com/googleplay/android-developer/answer/11926878
- Instalação de pacotes: https://support.google.com/googleplay/android-developer/answer/12085295
- Pagamentos: https://support.google.com/googleplay/android-developer/answer/9858738
- Exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Teste fechado: https://support.google.com/googleplay/android-developer/answer/14151465
- Recuperação Supabase: https://supabase.com/docs/guides/auth/passwords
- RLS: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
