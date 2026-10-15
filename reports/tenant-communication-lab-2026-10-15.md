# Laboratório isolado de comunicação dos agentes dos clientes

Versão preparada: **2026.10.15.16**. Escopo: atendente comum das lojas, preservando o fluxo separado do vendedor SaintsAI, agenda, pagamentos e mídia.

## Falhas reproduzidas e correções

- O retorno textual do provedor era aceito sem filtro adicional: marcadores de silêncio, referências de anexos fictícios, blocos de raciocínio e envelopes internos poderiam chegar ao atendimento. Agora esses formatos acionam o fallback; blocos `<think>` completos são removidos quando há uma resposta útil restante.
- Na indisponibilidade do provedor, uma saudação, agradecimento ou pedido de esclarecimento podia receber uma lista de serviços. O fallback agora diferencia esses turnos sem inventar dados.
- Se a consulta ao histórico falhasse, o atendente continuava com histórico vazio. Agora a falha segue para recuperação da fila, sem enviar uma resposta sem contexto.
- A verificação depois da geração descartava respostas ultrapassadas apenas do vendedor. Agora também cobre o texto de atendimento comum. Novas mensagens da mesma loja, conexão e contato impedem o envio da resposta antiga nessa verificação. Agenda, pagamentos e mídia com fluxos próprios mantêm suas saídas existentes.

O prompt do atendente recebeu orientações sobre linguagem natural, abreviações, perguntas curtas dependentes do histórico, ambiguidade e ações que exigem confirmação das ferramentas. A pergunta original e seus números são preservados; uma interpretação provável de abreviações é enviada como pista separada.

## Ambiente e reprodução

O laboratório usa o código compilado da imagem de produção, lojas fictícias, banco em memória e provedor simulado com injeção de falhas. Nenhum segredo ou dado de clientes é necessário. O executor Docker desativa a rede, torna o sistema de arquivos somente leitura e oferece apenas `/tmp` temporário. Não há endpoint público de testes nem novo serviço pago.

A CI executa automaticamente o laboratório e disponibiliza o resultado TAP no artefato **SaintsAI-Tenant-Communication-Lab**. O código está em `tests/tenant-dialogue-lab.test.cjs` e `tests/helpers/tenantDialogueLab.cjs`.

Para reprodução técnica a partir de um checkout limpo:

```sh
git archive HEAD | docker build -f Dockerfile.backend -t saintsai-tenant-lab -
node scripts/tenant-lab/run.cjs saintsai-tenant-lab
```

## Verificação local executada

- **64 testes do laboratório passaram**: 30 cenários novos, isolamento de lojas, controle humano, intenção de envio, recuperação da fila e confirmação idempotente de agendamento.
- **448 testes da seleção de produção passaram** no runtime compilado.
- **14 testes de montagem do prompt passaram** separadamente.
- Os cenários incluem dez mensagens seguidas, mensagem nova durante geração, retomada de job já enviado sem reenvio, tomada humana durante geração, falha do histórico e do provedor, abreviações, `??`, catálogo de barbearia/salão/clínica/loja e separação entre lojas/conexões/contatos.

A execução anterior à correção demonstrou os caminhos defeituosos; nem toda asserção que falhou era um defeito independente (algumas verificavam a nova marcação do atendimento).

## Limites e pendências

- **Não houve inferência no provedor real.** Respostas controladas comprovam o roteamento, tratamento de falhas e proteções testadas, não que um LLM compreenderá corretamente qualquer pergunta. Preços, conclusões clínicas, reservas e pagamentos não podem ser garantidos por testes de texto.
- A leitura do histórico é simulada no laboratório; testes de isolamento e os testes PostgreSQL existentes complementam a validação.
- Os testes de asterisco/60 segundos cobrem o módulo de controle humano em modo durável habilitado no ambiente isolado. As duas variáveis anteriormente deixadas em staging não são ativadas por esta alteração. Não se declara esse modo ativo em produção.
- O descarte de texto ultrapassado ocorre no ponto de verificação antes da intenção de envio. Ele não significa garantia de “exatamente uma vez” da rede WhatsApp; envios incertos continuam seguindo a proteção e revisão existentes.
- Nenhuma conversa, cliente, pagamento ou evento histórico de produção é alterado pelo laboratório. Nenhuma mensagem real de teste é enviada.

CI externa e publicação devem ser verificadas antes de declarar a versão publicada. Reversão de código: commit anterior `59544df943783ba8e6d0077c648395e4b3d62f31`, deployment `2ed61342-7df8-4992-a1a3-2e34ded4419c`.
