# SaintsAI: interface de 6 de outubro

Acabamento aplicado ao portal cliente e à central administrativa existente. Cabeçalho com marca SaintsAI, cartões compactos, adaptação para telas estreitas, botões com altura mínima, leitura dos registros e ações da gestão de clientes. O sino identifica pendências e retorna à aba Início antes de localizar a próxima etapa. O progresso inclui semântica para leitores de tela.

A publicação aplica o patch ao final da cadeia de build e atualiza cliente-versao.json e admin-versao.json para 2026.10.06.1. Não há alterações em banco, credenciais, planos, pagamentos ou processamento do WhatsApp.

Validação: cadeia de patches reproduzida integralmente (sem instalação de dependências ou smoke tests de produção), JavaScript e CSS analisados. Testes de DOM com APIs simuladas confirmaram menu, consulta financeira única inicial, erro/repetição, escape de texto, pendências e conclusão do setup, sino e retorno à aba Início; central administrativa confirmou filtros, receitas, saldo e clientes ilimitados. Não foi feita uma validação visual em navegador: o download do Chromium retornou um arquivo inválido.

## Segunda revisão (2026.10.06.2)

Nova composição do Início: capa com título e botão de agendamento, marca visível, versão carregada, resumo financeiro antes das pendências, atalhos em cartões e agenda de hoje. A agenda consulta o resumo existente, usa America/Sao_Paulo e exclui cancelados e outros dias. A consulta de agenda pode falhar sem derrubar o resumo financeiro. Nomes/serviços são escapados. Atualização remove apenas caches SaintsAI conhecidos, mantendo login e dados locais. Validação DOM adicional confirmou horário local, exclusão de cancelados e dias seguintes e escape de nomes na agenda; os três testes de atualização passaram.

## Identidade por empresa (2026.10.06.3)

Mais → Minha empresa permite nome exibido e foto/logo com prévia, remoção e salvamento. O nome SaintsAI da instalação permanece. A identidade é uma preferência no user_metadata do proprietário, em chave separada por loja; não participa de autorização. Rotas exigem autenticação e propriedade real da loja antes de ler/escrever. Caminhos de imagem pertencem à loja e precisam existir no bucket usado para imagens de serviço. A atualização sai do cabeçalho e fica em Mais/Minha empresa. Paleta mantém violeta na navegação, com tons frios no fundo e verde claro para ações/recebimentos, âmbar para pendências.

4 testes de controller simulados cobrem persistência, preservação de outras preferências/lojas, caminhos de outra empresa/URLs externas/fotos ausentes, validação do nome e remoção. Testes DOM verificam identidade no cabeçalho e atualização no menu; formulário confirma prévia, salvamento e recuperação de erro. Bucket de produção confirmado público e limitado a imagens/3 MB. Não foi alterado o schema ou autorização de contas. Auditoria de segurança mostrou avisos preexistentes de tabelas push sem RLS e outras configurações fora deste escopo; a nova preferência não cria tabela exposta. Testes não representam um upload completo real em conta de cliente.

## Upload e minimalismo (2026.10.06.4)

Causa do erro 413: o parser global de 100 KB executava antes dos parsers de upload de 5 MB. Middleware específico para serviço/produto agora verifica login e propriedade, depois interpreta JSON com limite de 5 MB antes do parser geral. O limite de 3 MB da imagem decodificada continua no controller; requisições comuns seguem limitadas a 100 KB. Webhooks preservam seus parsers anteriores.

A interface reduz ornamentos, capa, sombras e espaços. Atalhos compactos, cartões menores e atualização em Mais. Nome/foto, agenda e resumos mantidos.

Validação: 64 testes passaram na cópia construída, cobrindo uploads, identidade, atualização, condições comerciais, recebimentos, onboarding Asaas, contexto/worker. O teste de atualização administrativo deixava a versão presa a 04/10; foi atualizado para validar o formato. Foram feitos testes HTTP locais reais da ordem dos parsers, com armazenamento/auth simulados: payload de 300 KB percorre upload → marca → consulta; produto também aceita o payload; corpo comum >100 KB e fotos/corpos fora dos limites recebem 413; usuário sem login ou sem acesso recebe 401/403 antes do upload. Payload binário sintético verifica tamanho e integridade, não decodificação de pixels. Testes DOM adicionais passaram para menu, campos, recuperação de erro, resumo e central administrativa. Não foi feito checkout financeiro real nem teste de envio a contatos.
