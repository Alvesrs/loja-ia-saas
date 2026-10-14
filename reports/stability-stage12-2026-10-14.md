# SaintsAI — identificação de contato e regressão

A revisão confirmou um defeito no caminho de identidade WAHA: uma conversa autorizada como LID não era encontrada quando um evento seguinte usava o número público. O mapeamento anterior cobria LID → número e variantes brasileiras, mas não número → LID autorizado.

A nova correção verifica a identidade na conexão WAHA e somente usa o LID se existir conversa autorizada na mesma loja e sessão. Não cria autorização nem altera clientes/conversas. Identidades conhecidas não exigem nova consulta externa. Número ausente no WhatsApp permanece sem autorização; indisponibilidade na consulta gera erro recuperável, em vez de continuar com uma identidade que perde o vínculo. Isso é uma causa reproduzida no código, não prova de que explica todos os 133 eventos antigos.

Reprodução no código compilado: o teste existente de consistência LID/número falhava. Após a correção, seus 12 casos passaram. Quatro casos novos passaram, incluindo recuperação com cache vazio, isolamento de loja/sessão, identidade exata e indisponibilidade do provedor. Dois testes de variantes brasileiras passaram depois de atualizar a fixture para distinguir as respostas reais de check-exists e consulta de LID. Nenhuma mensagem real foi enviada; chamadas ao WAHA foram simuladas.

Outras quatro falhas vinham de fixtures/expectativas anteriores: o teste do service worker exigia um trecho textual, apesar de o worker atual não interceptar requisições; o teste de login não fornecia document ao código de renovação de sessão; a navegação passou a manter Plano/Ajuda no menu lateral; a recusa final não incluía a dependência atual do controle por asterisco. Os testes foram ajustados para verificar comportamento e dependências reais. Seus 17 casos passaram.

Nova execução ampla: 1.315 testes, 1.226 aprovados e 89 falhas. A suíte completa continua reprovada; nenhuma falha foi removida da execução. A confirmação na CI da nova correção de identidade ainda deve ocorrer.

Backup continua sem confirmação: a página Supabase ainda mostra login. Não houve migração, publicação, reinício, alteração de dados ou reenvio dos eventos legados. O PR permanece em revisão. APKs candidatos assinados da etapa anterior continuam disponíveis; esta etapa muda o backend e testes, não seus binários Android.
