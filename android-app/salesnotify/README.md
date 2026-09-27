# Gerenciador de Vendas Android — push

Módulo nativo preparado para FCM e notificações de venda com o app fechado.

Pendências para ativação:
1. Criar/usar projeto Firebase do SaintsAI.
2. Registrar o app Android com package `com.saintsai.sales`.
3. Adicionar `google-services.json` localmente/como secret no build (não versionar credenciais).
4. Ligar registro do token FCM ao backend e disparo na criação de venda.
5. Adicionar os sons em `res/raw` e permitir seleção por canal.
