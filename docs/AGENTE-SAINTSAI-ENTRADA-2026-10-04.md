# Entrada do APK Agente SaintsAI

As capturas do usuário mostram login “Vitrine”, página `login.html`, antes de qualquer painel. O APK adminapp usa esta página no proxy Supabase com `next=admin-mobile.html`. As mudanças anteriores não alteravam essa entrada.

Versão 2026.10.04.6: marca SaintsAI, identificação Administração / Agente SaintsAI, atualização na tela de login e link Criar conta de cliente. O link exige login e retorna ao cadastro administrativo; gravação continua protegida no servidor por exigirAdmin. Sem destino válido, o login abre admin-mobile, sem cair no dashboard antigo.

Login e service worker agora têm cache desabilitado no servidor. Corrigidas duas declarações duplicadas no worker legado, que causavam erro de sintaxe. Worker novo não armazena páginas e limpa somente caches antigos específicos deste app. Registro do worker respeita o caminho relativo, inclusive o proxy do APK.

Validação: sintaxe de worker/app/atualização; DOM simulado do login com destino padrão, cadastro e URL externa recusada, sem autenticar contas reais. Aparência final no aparelho ainda precisa ser verificada.
