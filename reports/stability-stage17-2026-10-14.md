# SaintsAI — regressões legadas e confirmação Android

- Commit 50a3d66810aaf6d74beda0415d2ae57a805bf113: CI 38556874606 e 38556867394 aprovados integralmente (backend, banco, interface, Android). CI 38556867549 aprovou APKs assinados.
- O ajuste de preparação do emulador foi confirmado em duas execuções completas. O bloqueio do SaintsAI continua testado, sem desativação.
- Oito falhas do webhook antigo eram fixtures sem dependências novas: controle humano, contexto comercial, menus/laboratório/demonstração e seleção do modo de lote. Atualizadas as dependências simuladas; preservados agrupamento, deduplicação, nenhuma saída direta e rejeição de contato não autorizado. Comando humano do cenário alinhado a '*'.
- Teste de entrada de entregas exigia formulário antigo, embora a página atual redirecione à central. Agora verifica redirect, destino existente e ausência da execução do formulário aposentado; os seis testes funcionais de localização/consentimento/isolamento continuam.
- Teste legal exigia um título antigo. Agora verifica o fluxo atual: solicitação na conta, alternativa por e-mail e verificação de titularidade, além das rotas públicas e conteúdo anterior.
- Executados localmente esses três arquivos no runtime completo: 17 testes, 17 aprovados. Incluídos no conjunto final do Docker, cuja nova execução deve confirmar 328 testes.
- Não se declara resolução das demais regressões amplas. Não houve envio externo, cobrança, migração, alteração de dados ou publicação. Backup integral ainda depende de autenticação no dashboard.
