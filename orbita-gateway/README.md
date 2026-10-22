# Entrada Google do Órbita

Estado em 21/10/2026: implementação e testes locais concluídos; criação da Function no Railway recusada com `Deploys have been paused temporarily`. Nenhum serviço novo ou endereço de retorno foi criado. Credenciais OAuth Google ausentes. Login real ainda não validado.

## Publicação

Criar uma Railway Function Bun com o conteúdo completo de `index.mjs`, trocando somente a importação por `google-auth-library@10` para instalação automática. Gerar domínio HTTPS e configurar variáveis exclusivamente nesse novo serviço, sem aplicar alterações pendentes de outros serviços.

- `PUBLIC_BASE_URL`: origem HTTPS gerada para a Function.
- `ORBITA_SOURCE_URL`: origem do app Sites existente.
- `ORBITA_SOURCE_SERVICE_TOKEN`: credencial de serviço Sites, apenas no servidor.
- `ORBITA_GOOGLE_SESSION_KEY`: 32 bytes aleatórios em hexadecimal, exclusiva da Function.
- `ORBITA_GOOGLE_BRIDGE_KEY`: outros 32 bytes aleatórios em hexadecimal, compartilhada somente entre Function e backend Sites.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: cliente OAuth **Aplicativo da Web** no Google Cloud.

No backend Sites configurar `ORBITA_GOOGLE_BRIDGE_KEY` como segredo e `ORBITA_GOOGLE_GATEWAY_URL` com a origem da Function. Republicar para aplicar a migração D1 e variáveis. Não modificar a chave de criptografia existente.

No Google Cloud cadastrar exatamente `PUBLIC_BASE_URL/auth/google/callback` como URI de redirecionamento. Configurar público e usuários de teste no projeto Google conforme o estágio do aplicativo. Escopos: openid, email, profile. Não usar chave Gemini. Não colocar segredos no repositório ou no navegador.

Verificar `/health`, `/auth/status`, login real, logout, isolamento entre contas e vínculo explícito antes de anunciar disponibilidade.

## Conta existente

Iniciar nos Ajustes do app original e confirmar o vínculo antes do primeiro bootstrap com Google. O vínculo expira em dez minutos e só pode ser usado uma vez. Não há associação automática por e-mail. Se a conta Google já criou uma empresa, a fusão é recusada.

## Segurança e limites

Biblioteca oficial verifica ID token Google; PKCE, state e nonce vinculam o retorno ao navegador. Sessão criptografada em cookie HttpOnly/Secure dura oito horas. Logout remove cookies; sessões copiadas não possuem revogação centralizada antes de expirar. Backend valida HMAC incluindo identidade, rota, método, corpo, horário e nonce de uso único. Dados e credenciais permanecem no backend privado. Entrada nativa ChatGPT preservada.

Testes: `npm ci --prefix gateway --ignore-scripts` e `node tests/google-auth.mjs`. Os testes usam provedor simulado; não comprovam credenciais ou aprovação do Google Cloud.

## Destino Render gratuito (22/10/2026)

Preparados `Dockerfile`, `start.mjs` (entrada HTTP Node) e `render.yaml`. Conectar a conta Render e escolher exclusivamente `plan: free`. O blueprint assume a raiz do repositório do Órbita. Configurar as variáveis listadas acima pelo painel; não versionar os valores. Definir PUBLIC_BASE_URL com a origem HTTPS efetivamente criada. O retorno OAuth será essa origem + `/auth/google/callback`. O backend Sites precisará receber a mesma bridge key e a URL nova, com republicação.

O serviço Google pode ter espera ao acordar. O estado OAuth e a sessão são cookies criptografados, de modo que o reinício não depende de arquivos locais se as chaves forem preservadas. O login real permanece pendente das credenciais Google e da publicação.

WAHA não foi migrado por este blueprint. No Free, o Render perde arquivos locais após reiniciar e não aceita disco persistente. Um WAHA com sessão local pode exigir novo pareamento. Não anunciar atendimento contínuo nem usar tentativas de contornar a suspensão. Manter dados e arquivos da empresa no backend atual. Sem assinatura, banco pago ou disco pago neste plano de migração.
