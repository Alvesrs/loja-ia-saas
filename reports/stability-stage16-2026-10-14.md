# SaintsAI — diagnóstico comprovado do PIN

- Commit 9579ad2a96da750b101027bc66421a8bb75e1459: execução 38556007615 aprovada em backend, Postgres e Android (20 testes Android, incluindo PIN). APKs assinados na execução 38556007515.
- Execução paralela 38556013887: backend/banco aprovados, PIN falhou. XML do artefato 11890592359 mostra keyguard_clock_container, lockscreen_clock_view_large, device_entry_icon_fg e indicação Device locked. Era a tela de bloqueio do aparelho, não o prompt do aplicativo.
- Preparação corrigida: manter tela do emulador ativa e, se o aparelho estiver bloqueado, desbloquear com o PIN sintético 1234 antes de iniciar a autenticação do SaintsAI. O teste continua exigindo confirmação posterior do PIN no aplicativo e verificando o estado desbloqueado do SaintsAI. Não se desativa o Keyguard ou a segurança do aplicativo.
- Nova execução ainda deve confirmar a correção da intermitência.
- Readiness de produção consultado: ok=true, worker iniciado, configuração ok. Isso descreve a versão antiga; não houve deploy desta branch.
- Backup integral continua não confirmado: dashboard Supabase em sign-in. Publicação, migrações, teste real externo e restauração não executados.
- Regressão ampla legada permanece parcialmente não aprovada (33 falhas no comando não recursivo); não se omite essa limitação.
