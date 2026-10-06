# Sessão persistente e bloqueio Android

Versão web 2026.10.06.8, SaintsAI Cliente 1.2.5 (20) e Agente SaintsAI 1.0.17 (18).

Causa: login retornava apenas access_token; token expirado causava limpeza completa no primeiro 401. Correção: retornar e persistir refresh_token e expires_at conforme opção manter conectado. Renovar antes de expirar, coalescer chamadas e usar Web Locks entre abas quando disponível. Atualizar tokens no mesmo armazenamento sem limpar seleção de loja. Renovação de outra aba não provoca logout. Não salvar senha. Falhas de rede/503/429 preservam estado; refresh inválido ou revogado requer novo login. Logout usa revogação de sessão local. Cliente Auth para refresh isolado por requisição, sem modificar cliente administrativo do worker.

Sessões antigas não têm refresh_token: precisam de um último login para passar ao novo formato. Não se amplia a duração de JWT nem desativa revogação do Supabase.

Privacidade e acesso no menu do perfil (cliente) e Configurações (admin). Bloqueio nativo opcional, habilitado/desabilitado somente após confirmação Android. Digital/biometria forte ou PIN do aparelho, com fallback Keyguard em Android antigo. Bloqueio na pausa e reapertura, camada opaca sobre WebView e FLAG_SECURE para ocultar captura/miniatura; navegação externa sai do WebView. Não substitui login do servidor, não protege outro navegador no mesmo celular, não armazena digital, nem impede alguém que conheça o PIN ou cuja biometria já esteja cadastrada no aparelho. Não equivale a criptografia de tokens pelo Keystore.

APKs anteriores não contêm o módulo nativo: requer instalação da atualização. Web sozinho continua com login persistente, mas não simula biometria. Cliente assinado com chave persistente já usada no aplicativo. Admin segue empacotamento debug existente; não há garantia de atualização em cima de uma instalação assinada por outra chave.

Validação local de rotação, concorrência, logout, troca de conta, falhas temporárias, 401 e limites de repetição. APK compilado e validado pelo workflow Android; teste instrumentado específico exige bloqueio opaco, FLAG_SECURE e recusa de cancelamento. Reconhecimento de digital precisa validação final no aparelho físico.
