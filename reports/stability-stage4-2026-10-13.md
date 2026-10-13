# SaintsAI — etapa 4: recuperar contexto após mensagem automática

## Bug comprovado e correção

Em `ownerSalesAutomation.service.js`, a condição de conversa previamente marcada como atendimento automático retornava silêncio incondicionalmente antes de avaliar perguntas comerciais e respostas válidas de briefing. O bloco de retomada estava inacessível. Isso podia manter em silêncio mensagens humanas como “Como funciona o SaintsAI?” e “Quanto custa o plano?”.

O patch `stability-auto-context-v1.js` torna esse bloco acessível. Preserva o silêncio para mensagens automáticas repetidas e pedidos fora do escopo, o encaminhamento de planos uma vez para um assistente conhecido e a liberação após apresentação explícita do responsável. Seis testes novos verificam esses caminhos com os módulos de contexto/prompt reais carregados em ambiente sem rede. Não foi comprovado que este bug explica todos os clientes sem resposta ou os 133 eventos antigos.

## Testes atualizados sem remover verificações

Os 81 testes de `prospect-attendance-isolation.test.js` agora executam o código atual:

- Contato sintético em formato LID válido, em vez de `isolated@lid`, rejeitado pela validação atual.
- Imports relativos resolvidos a partir de cada módulo, preservando o banco falso e o bloqueio de rede.
- Builder do banco falso com filtros e upsert utilizados pelo produto atual.
- Saudação automática verificada pela abordagem atual, sem tentar agendar na empresa prospectada.
- Sete recusas testadas até o worker e o envio simulado confirmado: a conversa permanece ativa antes da entrega, envia a resposta uma vez e é encerrada depois; uma nova chamada fica em silêncio.
- Laboratório testado usando o contato permitido que o próprio módulo define, sem enviar mensagem real. O fluxo atual pede o nome antes do menu fictício; o teste percorre ambas as etapas e conserva as verificações de ausência de agendamento real/LLM/rede.

Esse grupo passou nos **81 testes**, zero falhas. A maior parte das falhas antigas desse grupo vinha de fixtures incompatíveis e assertivas de uma etapa anterior; o retorno incondicional de silêncio era um bug do produto e foi corrigido separadamente.

## Resultados locais realmente executados

| Suite | Resultado |
| --- | --- |
| Recuperação de contexto automático | 6/6 passaram |
| Isolamento de prospecção e atendimento | 81/81 passaram |
| Suite focada ampliada | 183 passaram, zero falhas |
| Regressão ampla reconstruída | 1.264 testes; 1.154 passaram, 110 falharam |

O Dockerfile aplica os quatro patches de estabilidade e executa a suite focada ampliada. O job PostgreSQL isolado continua verificando a intenção durável e a concorrência em banco real. O resultado de CI desta revisão precisa ser registrado após conclusão; os sucessos de etapas anteriores não certificam este novo código.

## Limites e pendências

As 110 falhas continuam abertas. O grupo legado do atendente ainda pressupõe resposta/IA síncrona dentro do webhook, enquanto o produto usa fila, e há fixtures sem cadastro de loja; sua revisão não pode apagar os testes de isolamento. Permanecem os caminhos que enviam fora do worker, a serialização por conversa, controle humano para todas as lojas, revisão segura de envios incertos, interfaces e staging.

Produção, Supabase do SaintsAI, pagamentos, APKs e os 133 eventos antigos continuam preservados. Nenhum teste foi enviado a terceiros. A PR nº 15 permanece em rascunho e não representa uma versão publicada.

## Isolamento atual de dados entre lojas

Seis testes novos percorrem o resolvedor de destinatário e os serviços reais de contexto/prompt/IA, com banco e modelo simulados e sem rede. Passaram: IDs de loja/configuração forjados não mudam a loja resolvida; o mesmo contato em dois destinatários recebe catálogos e preços separados; a consulta exige loja e produtos ativos; o modelo só recebe o contexto da loja resolvida sem quantidades exatas; falha do modelo mantém o fallback na mesma loja; configuração inativa ou ambígua é recusada antes do catálogo. Esses testes não cobrem RLS/PostgREST nem substituem a revisão das 110 falhas legadas.

## CI final desta revisão

A execução [38478577094](https://github.com/Alvesrs/loja-ia-saas/actions/runs/38478577094), revisão `fe2f6335405d0707c43a2523871013f6e9dcf59d`, terminou SUCCESS. Os jobs de build Docker e PostgreSQL isolado passaram. A suite focada do build cobre os 183 casos desta revisão; a integração Postgres mantém seus cinco cenários. Não houve deploy de produção. Entre as 110 falhas restantes, o maior grupo é `whatsappAtendente.test.js` (38), seguido de envio (9) e isolamento de webhook de prospecção (8).
