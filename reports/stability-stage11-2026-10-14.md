# SaintsAI — prospecção com permissão e validação atual

CI 38542539086 terminou com os três jobs aprovados: imagem Docker, PostgreSQL isolado e Android. Foram aprovados 252 testes focados no backend, sintaxe de todos os módulos compilados, seis telas em quatro larguras, cadastro de serviços com preço numérico/imagens, validação de profissionais, comissão e recuperação após erro de salvamento. As compilações Android e a regressão de navegação/segurança no emulador passaram. Ainda são builds debug.

A seleção do plano autorizado de teste tinha um defeito real: `testeplano:basico` também atendia à expressão de pedido de menu. O menu era retornado antes de processar a escolha, impedindo preparar a contratação. A correção dá precedência à escolha válida; os nove testes existentes passaram, incluindo preço comercial preservado, não duplicar Pix, cancelamento confirmado e restrição à conta/número previamente autorizados. Nenhuma cobrança real foi criada nos testes.

## Prospecção

As fontes oficiais consultadas em 14/10/2026 exigem permissão do destinatário e respeito à recusa. Encontrar telefone público não prova essa permissão; o limite de oito vagas não substitui consentimento.

- https://whatsappbusiness.com/policy/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in

A nova correção mantém pesquisa, priorização, oito vagas, intervalos e abordagens existentes. Contatos na fila automática aguardam registro explícito da permissão recebida. A tela oferece registrar origem e confirmação ou revogar a permissão; esses atos não enviam mensagens. A permissão é vinculada a um item e loja, registrada pelo dono autorizado e armazenada no JSON `business` já existente. Não cria tabela nem preenche permissão para contatos antigos. A reivindicação de envio compara o JSON para evitar usar uma revisão substituída. Recusa conhecida na loja bloqueia a abordagem automática. Um envio que já começou não pode ser desfeito.

Sete testes novos aprovados localmente: ausência de permissão, registro, revogação, recusa, outra loja/ator, revisão concorrente, falha no banco e seleção apenas do item autorizado. Doze testes existentes de prospecção continuam aprovados, incluindo limite de oito e ausência de reenvio após resultado incerto. A nova tela tem teste de navegador na CI; o resultado do commit desta correção precisa ser confirmado.

Limitação: o registro é uma declaração do operador sobre permissão realmente recebida, não uma verificação automática da origem. Não enviar a primeira mensagem pelo WhatsApp apenas para pedir a autorização. A correção cobre a rodada automática; demais ações manuais/iniciações comerciais ainda precisam de revisão equivalente. Meta conserva requisitos próprios de janela de atendimento e modelos aprovados. Não há promessa de impedir restrições da plataforma.

## Regressão e produção

Nova execução local completa com arquivos auxiliares e Android: 1.304 testes, 1.210 aprovados, 94 falhas, antes dos sete casos novos de consentimento. A suíte global continua reprovada. Testes antigos de webhook síncrono, IA imediatamente no recebimento e contratos anteriores respondem por grande parte das falhas; a classificação integral e substituição por cobertura do fluxo efetivo permanecem pendentes. Os testes antigos foram preservados, não apagados.

Consulta de produção: readiness retorna `ok:true`, ambiente production, worker iniciado e configuração ok. Deployment backend-prod continua `7fe0775a-1c69-4652-97a6-6d808f5dafca` (SUCCESS). Banco mostra 200 jobs concluídos na fila e os mesmos 133 eventos antigos processando. Essa fotografia não comprova todos os caminhos reais de atendimento. Não houve reenvio, reinício, alteração de dados, migração ou publicação.

Backup completo permanece sem confirmação: painel redireciona ao login. Nenhum segredo foi solicitado em conversa nem lido pelo agente. Publicação depende de backup, solução das falhas críticas da regressão, validação do fluxo real em testes e preparação dos APKs assinados e da implantação controlada.
