# SaintsAI — validação e correções de pagamento, 14/10/2026

## Código e ambiente

PR #15, branch `audit/saintsai-stability-20261013`. Nenhuma migração, reinicialização ou publicação em produção realizada nesta etapa. O runtime usado na revisão foi extraído do Docker produzido pela própria CI, após aplicar a cadeia completa de patches do projeto; não é o código parcial obtido do ZIP inicial.

CI 38493465410, commit `3f64fb2704331b36d50bcd0724450a84371314ee`: três jobs aprovados. Docker: 217 testes focados aprovados; verificação de sintaxe de todos os módulos compilados aprovada. PostgreSQL isolado aprovado. Seis telas verificadas em 320, 390, 768 e 1440 px, com navegação, valores financeiros, IDs e estado offline preservados. Três aplicativos Android compilados; regressão de navegação e segurança em emulador aprovada. Os APKs desta CI são debug, não uma atualização assinada de produção.

## Entrega de acesso após pagamento

O módulo de entrega tinha expressão regular inválida; isso impedia seu carregamento no caminho de confirmação do Asaas. A entrega também ativava a conta antes do envio sem registrar uma etapa recuperável, permitindo perder a notificação.

A correção usa os estados `pending`, `intent` e `confirmed` no JSON de pagamento existente, com atualização condicional. A conta paga fica ativa independentemente da notificação. Somente entregas novas explicitamente pendentes podem ser tentadas pelo worker; contas ativas antigas e resultados incertos não são reenviados. A intenção é persistida antes da chamada externa, impedindo duas confirmações concorrentes de enviar novamente. O marcador não guarda a senha temporária nem o texto das credenciais. A consulta de operação retorna apenas contagens por loja autorizada.

Seis testes específicos aprovados, incluindo concorrência, erro anterior ao envio, timeout ambíguo e falha de finalização. São simulações, sem Asaas ou WhatsApp reais.

## Confirmação de pagamento de agendamento

Os caminhos Asaas e PagBank liberavam o marcador de envio em qualquer exceção, inclusive um timeout posterior a uma possível entrega. Isso permitia duplicidade em uma nova confirmação. A nova correção mantém o marcador quando a chamada externa já começou; antes disso, libera somente a reserva que ainda corresponde ao timestamp desta tentativa. Também verifica a resposta `enviado` e trata erros de consulta sem prosseguir silenciosamente.

Reprodução: código original extraído da CI falhou em cinco dos dez testes novos. Código corrigido passou nos dez. Cobertura: chamadas concorrentes, repetição, timeout ambíguo, retorno não confirmado, erro anterior ao envio e falha de reivindicação no banco, para ambos os provedores.

Limitação: o campo legado `pagamento_confirmacao_enviada_em` funciona como bloqueio/intenção; sozinho não prova entrega confirmada. Resultados incertos requerem conferência, sem reenvio automático. Recuperação persistente de notificações de agendamento anteriores ao envio ainda precisa de trabalho; esta correção evita duplicidades e não declara esse fluxo totalmente recuperável.

## Regressão ampla

Execução local sobre o runtime compilado, com arquivos auxiliares do repositório e dependências de validação: 1.302 testes, 1.199 aprovados, 103 falhas. Nenhuma aprovação global. Muitos testes legados carregam contratos antigos de webhook síncrono, tomada humana por mensagem comum e dependências de fixtures anteriores. A classificação completa das falhas permanece pendente; não foram ignoradas nem removidas da suíte.

As fixtures de notificação administrativa foram delimitadas à rota testada e atualizadas para a autorização existente. A fixture de seleção de empresa distingue a consulta da lista e a preferência por usuário. Verificação da apresentação mantém os controles de autenticação e reconhece páginas públicas e redirecionamentos. Esses 14 testes passaram localmente. Um teste de navegador de cadastro de serviços/profissionais foi adicionado à CI; seu resultado ainda deve ser confirmado.

## Produção e publicação

Backend-prod continua no deployment `7fe0775a-1c69-4652-97a6-6d808f5dafca`, status SUCCESS, com rollback disponível. Os 133 eventos legados continuam em processando (132 WAHA, um Meta), sem reenvio. Não foram apagados clientes, pagamentos ou conversas.

Backup completo do banco ainda não confirmado: o painel Supabase exigiu autenticação e o fluxo seguro não teve confirmação de conclusão. O ponto de reversão do código/deployment não substitui backup de dados. Publicação e migrações permanecem bloqueadas até resolver esse requisito, validar as pendências críticas e preparar implantação controlada. Limites de oito conversas permanecem preservados; nenhum teste enviou mensagens a terceiros.
