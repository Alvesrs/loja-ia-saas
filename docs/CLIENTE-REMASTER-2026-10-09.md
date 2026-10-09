# SaintsAI Cliente — remaster de 9 de outubro

O portal do cliente passa a usar uma camada visual final consistente, com contraste melhor, campos de 48 px e navegação móvel focada em Início, Agenda, Agente IA e Negócio. O menu Negócio mantém serviços, profissionais, produtos, galeria, WhatsApp, pagamentos e plano acessíveis. As pendências de configuração aparecem antes do resumo diário.

A alteração preserva os elementos existentes, seus eventos e as chamadas de API. O painel administrativo e o código nativo Android não recebem alterações. O APK instalado carrega o portal atualizado; não é necessário mudar a assinatura nem reinstalar o app.

Higgsfield foi consultado para uma referência visual. A geração foi recusada com `Requires basic plan or higher`; nenhuma imagem foi gerada ou incorporada.

Validação: 32 testes de regressão de atualização, marca, recebimentos, galeria e reparos críticos passaram. Login e início foram exercitados com dados simulados em 360, 412 e 1440 px, incluindo mostrar senha, validação de campos vazios, navegação, menu, abas e ausência de overflow. Esses testes não representam uma nova transação real de Pix nem uma conversa real no WhatsApp.

Build: `patches/cliente-remaster-v5.js` deve rodar após as camadas anteriores de interface. A versão do portal passa para `2026.10.09.1`.
