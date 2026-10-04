# Central administrativa SaintsAI

Versão 2026.10.04.8. O Início é dedicado ao SaaS: clientes que pagaram, total confirmado, confirmado no mês, acessos ativos, vencimentos em até sete dias e clientes cadastrados. A antiga visão de produtos/lucro/estoque fica fora da central. O aplicativo Gerenciador de Vendas continua independente.

Lista de clientes com busca, filtros e paginação de 20: plano, preço público ou exclusivo, validade, valor confirmado por cliente, uso real e mensagens disponíveis. Ilimitado é identificado sem inventar saldo numérico. Atalhos de configuração, plano/preço e WhatsApp. Cadastro público também aparece e pode ser gerenciado pelo administrador autenticado; usuários comuns continuam restritos às próprias lojas.

Recebimentos armazenados em `saintsai_receitas_planos`, por ID do pagamento e ambiente. Notificações de confirmação/recebimento não duplicam valores. Renovações diferentes somam. Sandbox, pagamentos pendentes e liberações manuais não viram receita. Estornos totais removem o valor dos totais; valores parciais informados pelo provedor são deduzidos. Números são confirmados antes de taxas Asaas, não lucro ou saldo bancário. Dia e mês financeiros seguem America/Sao_Paulo.

O histórico é consultado automaticamente ao abrir a central, com botão de repetição Sincronizar Asaas. A consulta é GET no provedor e importa somente pagamentos relacionados a cobranças de planos já conhecidas pelo sistema. Não cria cobranças, não envia mensagens e não ativa planos retrospectivamente. Pagamentos sem vínculo identificável não são atribuídos a clientes por suposição. Novos eventos atualizam o registro; tela atualiza dados a cada minuto quando visível.

Schema reproduzível em `patches/assets/admin-receitas.sql`, RLS ativo, sem grants anon/authenticated e com acesso backend. INFO de RLS sem policies é intencional para tabela privada de backend. Histórico financeiro preservado quando cliente é excluído (referência interna preservada, loja FK set null).

Validação: testes de idempotência, renovação, sandbox, pendência, liberação manual, estorno, São Paulo, paginação após mil registros, cliente público e saldo; DOM simulado de métricas, lista, filtros, ilimitado, importação e escape de nomes. Conferência visual no aparelho Android pendente. Não foram criadas contas ou cobranças reais durante os testes.
