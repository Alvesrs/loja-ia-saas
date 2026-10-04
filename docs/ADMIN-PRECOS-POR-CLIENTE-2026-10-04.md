# Cadastro administrativo e condição comercial por cliente

No app SaintsAI Admin, Registro abre um cadastro guiado: conta, plano/preço e revisão. O dono escolhe Básico, Pro ou Ilimitado, mensalidade própria positiva e período inicial de 1, 3, 6 ou 12 meses. Pode liberar imediatamente ou aguardar pagamento. Liberação manual não insere cobrança nem afirma pagamento recebido.

A condição é persistida por empresa em `saintsai_condicoes_comerciais`. Somente endpoints protegidos por `exigirLogin` e `exigirAdmin` podem gravar. Anon e authenticated não possuem privilégios na tabela; RLS sem políticas de acesso cliente é intencional. Cadastro público continua usando os preços e planos públicos, sem aceitar valor definido pelo cliente.

Pix de assinatura, checkout mensal criado após a mudança e ofertas de renovação consultam o preço salvo no servidor. A condição altera somente o preço do plano escolhido, mantendo seus limites. Os demais planos da mesma empresa usam o preço normal. Voltar à condição pública remove o acordo. Pix já emitidos e assinaturas recorrentes já existentes no provedor mantêm o preço original: a alteração afeta novas cobranças geradas pelo sistema, sem modificar remotamente contratos existentes.

Cliente visualiza a própria condição negociada e pode renovar por ela; não consegue editar. Na configuração administrativa de plano, mensalidade pode ser atualizada ou restaurada ao preço público. Alterações pendentes são salvas antes de gerar Pix/liberar acesso.

SQL reproduzível: `patches/assets/admin-condicoes-comerciais.sql`, aplicado em 04/10/2026. Verificados RLS ativo, acesso anon/authenticated negado e gravação backend permitida. Advisor INFO sem policy é esperado para tabela acessada apenas pelo backend. Nenhuma condição foi criada para clientes reais durante validação.

Validação: 11 testes backend de isolamento, centavos, permissão, cadastro, compensação e cobrança; 32 testes existentes; fluxo DOM simulado de cadastro guiado e condição comercial. Nenhuma conta real criada e nenhum Pix real emitido. Visual Android precisa de conferência no aparelho.
