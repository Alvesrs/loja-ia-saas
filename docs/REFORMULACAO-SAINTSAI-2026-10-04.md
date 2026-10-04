# SaintsAI: atendimento híbrido e revisão de 4 de outubro de 2026

## Estado confirmado

Repositório: Alvesrs/loja-ia-saas. Backend de produção localizado no Railway; último deployment observado com status SUCCESS. Os logs do build confirmam a execução completa do railway.json, incluindo Asaas, serviços, agenda e agrupamento de contexto; a lista resumida da configuração do serviço não representa sozinha o build efetivo.

O cadastro já contém produtos com variações de estoque, fotos, serviços, profissionais, configuração de pagamentos e agenda. A consulta comum da IA lia produtos; os serviços entravam por outros caminhos e pelo Prompt Mestre sincronizado. O envio comum de WhatsApp era de texto e não enviava a foto cadastrada do produto. O histórico usado pelo atendente procurava a conversa entre as 50 mais recentes e limitava mensagens em ordem crescente, podendo selecionar o começo de uma conversa longa.

## Mudanças desta revisão

- Produtos e serviços ativos são consultados na loja correta e entram juntos no contexto da IA. Preço, duração e disponibilidade continuam vindo do cadastro; agenda e pagamento exigem resultado real das ferramentas.
- O histórico do atendimento passa a consultar diretamente loja + configuração WhatsApp + contato. Busca as 30 mensagens mais recentes e as reorganiza em ordem cronológica. O limite existente do LLM continua em 12 mensagens; a seleção de foto pode usar o histórico consultado.
- Pedido de foto com o nome cadastrado seleciona um único item. Pedidos genéricos podem retomar uma referência anterior do cliente. Ambiguidade gera uma pergunta; ausência de foto gera uma resposta explícita.
- Fotos de upload da própria empresa podem seguir por WAHA ou Meta como uma única mensagem com legenda, preservando o controle de finalização do worker. Não são utilizadas URLs produzidas pelo LLM ou pelo cliente. URLs de outra empresa, externas, privadas ou com credenciais são recusadas.
- Fotos têm prioridade sobre áudio no envio do worker. Finalização de jobs já enviados continua sem novo envio.
- Quando a IA escolhe não responder, o worker conclui fila e idempotência em vez de deixar a mensagem em processamento.
- A configuração de IA ganha a área “Ensinar a IA com uma correção”. O dono escreve a regra, adiciona ao Prompt Mestre, revisa e usa “Salvar IA” para ativar. O bloco utiliza a persistência e autorização já existentes; não requer tabela ou migração nova.
- Etapas inspect-* que apenas imprimiam código e diagnósticos foram removidas do comando de publicação. As etapas funcionais existentes são mantidas. Os testes novos passam a bloquear a publicação em caso de falha.

## O que significa aprender

Contexto de uma conversa e correções aprovadas pelo dono são duas coisas diferentes. O primeiro mantém continuidade para um cliente; as segundas orientam novos atendimentos da mesma empresa. Esta revisão não modifica pesos do modelo, não faz fine-tuning e não transforma mensagens dos clientes em regras globais. Não foi implementada uma memória resumida permanente além do histórico existente.

## Validação

A base ZIP foi extraída em uma cópia separada, com todos os arquivos auxiliares do repositório. As etapas de patch do build foram aplicadas em ordem e sem falhas. A instalação de dependências e o smoke test que acessa banco de produção não foram executados nessa reprodução.

67 testes passaram: 19 novos cenários de atendimento híbrido/worker e 48 verificações existentes de contexto de catálogo, histórico e adaptador Meta. Cobrem produtos + serviços no mesmo contexto, fallback de serviço, foto com nome, referência anterior, ambiguidades, mídia não cadastrada, isolamento de loja, rejeição de URLs inseguras, payloads de Meta/WAHA, fluxo de texto, silêncio e finalização sem reenvio. A reaplicação do novo patch também passou, verificando sua idempotência.

Esses testes usam banco/provedores simulados e não enviam mensagens ou cobranças a pessoas. Não comprovam entrega de foto pelo WAHA instalado, crédito de uma venda real no Asaas ou layout em todos os APKs. A suíte histórica integral contém expectativas de etapas antigas (inclusive registro sem WAHA e contrato exclusivamente de texto); não foi declarada aprovada.

## Próximos itens da reformulação completa

| Área | Situação / trabalho restante |
| --- | --- |
| Produtos | Confirmar experiência completa de compra: escolha de variação, reserva de estoque, pedido, pagamento Asaas, baixa e cancelamento/estorno. Não foi confirmado checkout de produto nesta revisão; o fluxo encontrado é principalmente de agendamento. |
| Serviços | Validar agendamento real por profissional, Pix, dinheiro, reagendamento e cancelamento com cenários de concorrência. |
| Fotos | Testar entrega real sem mensagens a terceiros não autorizados. Confirmar suporte do WAHA instalado. JPEG/PNG seguem como mídia pela Meta; WebP recebe link direto da foto cadastrada, sem tentativa de enviar um formato incompatível. |
| Aprendizado | A área atual é de correções manuais aprovadas pelo dono. Sugestões automáticas a partir das conversas, revisão, rejeição e histórico de versões ainda não existem. |
| Interface | O painel ainda prioriza agenda no onboarding/dashboard. Definir tipos “Produtos”, “Serviços” e “Ambos” e adaptar métricas e etapas sem exigir profissionais/agenda de uma loja de roupas. |
| WhatsApp | Revisar agrupamento, envio direto e fila; não se deve prometer processamento exatamente uma vez em todas as quedas, pois enviar ao provedor e gravar no banco são operações distintas. |
| Publicação | Continuar substituindo patches textuais e base ZIP por módulos versionados, com dependências fixadas e testes adequados. A revisão atual mantém a cadeia existente para evitar uma migração estrutural sem validação completa. |

Referências dos payloads consultados: https://waha.devlike.pro/docs/how-to/send-messages/ e https://www.postman.com/meta/whatsapp-business-platform/request/u5m7uk7/send-image-message-by-url.
