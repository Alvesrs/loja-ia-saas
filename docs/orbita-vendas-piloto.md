# Órbita Vendas — piloto comercial

## Objetivo
Transformar o Órbita existente em um assistente de vendas por WhatsApp, sem apagar funcionalidades ou dados atuais. O piloto deve ser isolado da produção até passar nos testes.

## Oferta inicial
Serviço de atendimento e acompanhamento de orçamentos para uma única categoria de pequenos negócios. Configuração assistida pelo operador. Preços e promessas comerciais só podem vir de configuração autorizada.

## Fluxo mínimo
1. Receber mensagem por canal autorizado.
2. Identificar intenção e responder perguntas usando catálogo/base de conhecimento do cliente.
3. Coletar dados mínimos necessários com transparência sobre o uso de IA.
4. Registrar oportunidade e estado da conversa com isolamento por empresa.
5. Solicitar consentimento para acompanhamento e respeitar opt-out.
6. Enviar lembrete de orçamento apenas dentro das regras do canal.
7. Encaminhar para humano quando houver dúvida, reclamação, exceção ou baixa confiança.
8. Registrar desfecho e métricas: tempo de resposta, orçamento acompanhado, venda confirmada e custo por atendimento.

## Segurança e confiabilidade
- Não inventar preços, estoque, prazos, descontos ou garantias.
- Não se passar por pessoa humana.
- Adaptar formalidade e concisão, sem imitar identidades ou explorar vulnerabilidades.
- Validar regras de WhatsApp Business e LGPD antes de iniciar disparos.
- Isolar dados por empresa e limitar acesso por função.
- Proteger credenciais; não registrar dados sensíveis em logs.
- Evitar migrações destrutivas; preservar branch de produção.

## Critérios para publicar
- Autenticação funcional; integração WhatsApp ponta a ponta; teste com dois negócios isolados.
- Encaminhamento humano e interrupção do agente funcionando.
- Sem mensagens duplicadas; tratamento de falhas e idempotência.
- Medição de custo de IA e mensagens.
- Demonstração validada antes de oferta comercial.

## Plano de execução
1. Auditar árvore de arquivos e arquitetura real da branch orbita-render-free.
2. Identificar backend, autenticação, agentes, integrações e variáveis de ambiente.
3. Implementar fluxo de oportunidades e atendimento em branch isolada.
4. Testar localmente, em staging e somente então considerar deploy.
5. Entrevistar dez negócios e buscar três pilotos pagos antes de ampliar funcionalidades.
