# Pagamentos guiados — SaintsAI Cliente 2026.10.04.3

## Experiência do estabelecimento

Pagamentos começa com duas opções: ainda não tenho conta Asaas e já tenho conta Asaas.

O primeiro caminho usa o endpoint de criação já existente, dividindo o cadastro em titular, endereço e revisão com autorização explícita. CPF/PJ, data digitável, contato e endereço são validados antes do envio. A alternativa de abertura direta no Asaas também está disponível.

O segundo caminho orienta a geração da chave de API, solicita e-mail para avisos e autorização, valida a conta e provisiona somente o webhook SaintsAI correspondente à loja. A chave é armazenada no mecanismo protegido existente; não retorna ao navegador e é apagada do campo após sucesso.

A tela diferencia conexão de aprovação. Consulta dados do titular, documentos, dados bancários e aprovação geral no Asaas. Documentos podem abrir os links oficiais retornados pelo provedor; quando não estão disponíveis, o cliente é orientado a concluir pelo Asaas. Para conta recém-criada, respeita o intervalo de 15 segundos antes de consultar documentos. Atualizações são manuais, sem polling contínuo.

Recebimentos dos clientes e assinatura SaintsAI têm explicações e acessos separados. Taxas e prazos não são inventados: há acesso às condições do Asaas. Sandbox é identificado como teste sem dinheiro real.

## Correções necessárias ao fluxo

- Salvar formas de pagamento mantém a conexão existente; troca de provedor conectado é rejeitada.
- Leitura de credenciais aceita o formato JSON protegido e as chaves legadas, antes incompatíveis com o serviço de Pix de agendamento.
- Requisições do provedor usam o ambiente identificado pelo prefixo da chave e têm timeout.
- Progresso da etapa Asaas usa o provedor Asaas e aprovação confirmada, substituindo a comparação incorreta com PagBank.
- Nova conexão é gravada somente depois de confirmar o webhook. Não altera webhooks de outros sistemas.
- Cadastro e conexão compartilham bloqueio por loja no processo; a tela também impede envio repetido. Não é uma garantia de idempotência distribuída em múltiplas réplicas ou após timeout do provedor.

## Validação e limites

10 testes focados: conexão versus aprovação, links oficiais, indisponibilidade, webhook antes da gravação, falha parcial, ambientes, conta já conectada, preservação das opções e formatos da chave. 22 testes anteriores de atendimento e atualização também passaram.

Teste DOM com os scripts reais e dados fictícios: campos obrigatórios, nascimento inválido, cadastro PF em três etapas, revisão mascarada, autorização, uma única submissão, pendências, documentos, aprovação, conexão existente e limpeza da chave.

Campos existentes confirmados por consulta de metadados no banco. Nenhuma migração ou alteração de permissões. Não foram criadas contas financeiras nem cobranças reais em testes. A aprovação de um titular depende do Asaas. O uso de subcontas em produção continua sujeito ao modelo contratado e às regras do provedor. Inspeção visual no Android permanece pendente pela indisponibilidade do navegador local.

## Fontes oficiais consultadas

- https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta
- https://docs.asaas.com/docs/onboarding-e-envio-de-documentos-via-link
- https://docs.asaas.com/docs/criacao-de-subcontas
- https://docs.asaas.com/reference/criar-novo-webhook
- https://central.ajuda.asaas.com/hc/pt-br/articles/33618186066331-Como-gerar-uma-nova-chave-de-API-no-Asaas
