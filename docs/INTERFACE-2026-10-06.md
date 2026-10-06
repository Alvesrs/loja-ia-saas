# SaintsAI: interface de 6 de outubro

Acabamento aplicado ao portal cliente e à central administrativa existente. Cabeçalho com marca SaintsAI, cartões compactos, adaptação para telas estreitas, botões com altura mínima, leitura dos registros e ações da gestão de clientes. O sino identifica pendências e retorna à aba Início antes de localizar a próxima etapa. O progresso inclui semântica para leitores de tela.

A publicação aplica o patch ao final da cadeia de build e atualiza cliente-versao.json e admin-versao.json para 2026.10.06.1. Não há alterações em banco, credenciais, planos, pagamentos ou processamento do WhatsApp.

Validação: cadeia de patches reproduzida integralmente (sem instalação de dependências ou smoke tests de produção), JavaScript e CSS analisados. Testes de DOM com APIs simuladas confirmaram menu, consulta financeira única inicial, erro/repetição, escape de texto, pendências e conclusão do setup, sino e retorno à aba Início; central administrativa confirmou filtros, receitas, saldo e clientes ilimitados. Não foi feita uma validação visual em navegador: o download do Chromium retornou um arquivo inválido.

## Segunda revisão (2026.10.06.2)

Nova composição do Início: capa com título e botão de agendamento, marca visível, versão carregada, resumo financeiro antes das pendências, atalhos em cartões e agenda de hoje. A agenda consulta o resumo existente, usa America/Sao_Paulo e exclui cancelados e outros dias. A consulta de agenda pode falhar sem derrubar o resumo financeiro. Nomes/serviços são escapados. Atualização remove apenas caches SaintsAI conhecidos, mantendo login e dados locais. Validação DOM adicional confirmou horário local, exclusão de cancelados e dias seguintes e escape de nomes na agenda; os três testes de atualização passaram.
