# Atualização administrativa e cadastro no Início

Versão 2026.10.04.5. O cadastro com preço exclusivo estava apenas na aba Registro. Agora o Início tem um card de criação de conta com botão “Criar cliente”. Registro continua disponível.

O botão permanente “Atualizar app” consulta a versão publicada sem cache e recarrega a página atual com URL única, preservando aba, loja e login. Funciona na rota direta e no proxy usado pelo APK. Offline ou versão inválida mantém a tela e habilita nova tentativa. As telas administrativas e o arquivo de versão usam cabeçalhos sem cache.

Mudança da interface web servida ao APK; não instala um novo binário Android. Se a interface antiga já estiver aberta, fechar/reabrir ou acessar o endereço com parâmetro de atualização carrega o botão pela primeira vez.

Validação: testes de atualização/offline, DOM simulado do Início e do botão de atualização, sintaxe e regressão de cadastro/preço. Conferência visual no aparelho Android permanece pendente.
