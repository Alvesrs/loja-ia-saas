# Interface SaintsAI Cliente — 2026.10.04.2

Atualização visual do portal que o aplicativo Android já abre. O botão Atualizar app recarrega a versão web; não exige instalar outro APK.

## Mudanças

- Identidade escura com roxo, cartões com hierarquia visual e campos com foco e tamanho adequado para toque.
- Menu lateral no desktop e navegação inferior no celular, com Produtos, Agenda e IA. Serviços, WhatsApp, pagamentos, estoque, plano e configurações ficam acessíveis pelo menu Mais.
- Visão geral disponível durante a configuração. Etapas concluídas deixam de ocupar o painel.
- Registros recentes, conexões e resumo financeiro dos agendamentos. Não soma vendas de mercadorias sem registros financeiros reais.
- Um único controlador do painel substitui duas renderizações e consultas concorrentes. Atualização financeira a cada 60 segundos somente com a página visível; requisições simultâneas compartilham a mesma consulta.
- Estados de carregamento, vazio e indisponibilidade com nova tentativa. Conteúdo dos registros escapa caracteres HTML.
- Estilo compartilhado em catálogo, estoque, agenda, WhatsApp, configurações e plano. Serviços ficam identificados separadamente de mercadorias.

## Referências de organização

Respond.io (https://respond.io/team-inbox): hierarquia de atendimento e conexões.
Trinks (https://negocios.trinks.com/solucoes/): agenda e serviços.
Bling (https://ajuda.bling.com.br/hc/pt-br/articles/27431863602455-Conhe%C3%A7a-o-dashboard-Meu-Neg%C3%B3cio): resumo do negócio.
Não foram copiados logotipos, imagens ou componentes dessas plataformas.

## Validação

- Sintaxe do JavaScript e aplicação do patch no runtime reconstruído.
- 22 testes existentes de atendimento híbrido, fila e atualização web passaram.
- Teste DOM com scripts reais e dados fictícios: uma consulta financeira inicial, coalescimento de consultas concorrentes, navegação do catálogo, menu abrir/fechar, escape de conteúdo, atualização no cabeçalho, pendências e conclusão, erro e nova tentativa.
- A inspeção visual em navegador/Android ficou pendente: o ambiente não disponibilizou Chromium e o navegador remoto bloqueou localhost. Os breakpoints CSS foram implementados para celular/tablet/desktop; não há alegação de verificação visual desses tamanhos.
