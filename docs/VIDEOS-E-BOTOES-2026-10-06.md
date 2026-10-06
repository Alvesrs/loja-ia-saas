# Vídeos e ações do atendimento — 2026.10.06.6

A empresa pode anexar, substituir e remover um MP4 de até 10 MB por produto ou serviço em `/cliente/cliente-midias.html`. O upload é binário, autenticado antes do parser e limitado por empresa e item. O backend gera o caminho do arquivo; URLs arbitrárias não são aceitas pelo envio ao WhatsApp. Vídeos públicos usam o bucket `saintsai-videos`; substituições limpam o arquivo anterior somente dentro da própria empresa. A remoção retira a referência do item e tenta limpar o arquivo.

Pedidos explícitos de vídeo consultam os itens ativos da empresa e o contexto recente do próprio cliente. Ausência ou ambiguidade gera uma explicação, sem inventar mídia. O WAHA usa `sendVideo` e a Meta usa mídia `video`. MP4 H.264 com AAC ou sem áudio é o formato indicado.

Respostas determinísticas da agenda podem gerar confirmação/desistência, opções de pagamento, lista de serviços, horários, lista de agendamentos e CTA para o link público real. Somente respostas da agenda geram ações; o LLM não gera URLs ou instruções de botão. Os IDs selecionados são convertidos em texto e passam novamente pelo fluxo de agenda, com disponibilidade e pagamento revalidados. No WAHA, botões estão descontinuados segundo a documentação: mantém-se a resposta com texto e link. Botões nativos ficam restritos à conexão oficial da Meta.

Validação: 164 testes passaram (upload, limites, propriedade, mídia, formato do envio, interpretação dos cliques, contrato dos provedores e regressões). DOM com os scripts reais da tela de vídeos: upload, erro/reenvio, prévia, remoção, busca e limite. MP4 H.264 real gerado localmente foi aceito pelo verificador. Pipeline de patches reconstruído desde o ZIP; o smoke test legado que exige credenciais reais do Supabase não pôde rodar localmente, e o restante do pipeline passou. A entrega em um telefone real do WhatsApp não foi testada nesta alteração.

Banco: colunas opcionais `video_url` e `video_path` em produtos/serviços e bucket de MP4 de 10 MB confirmados após aplicar SQL; RLS das tabelas existentes preservada. Migração reproduzível criada pelo CLI e guardada em `supabase/migrations`.
