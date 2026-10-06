-- Colunas opcionais; preserva catálogo existente e políticas RLS das tabelas.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.saintsai_servicos ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.saintsai_servicos ADD COLUMN IF NOT EXISTS video_path text;
-- Arquivos públicos para envio pelo WhatsApp. Escritas somente pelo backend.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('saintsai-videos','saintsai-videos',true,10485760,ARRAY['video/mp4'])
ON CONFLICT (id) DO NOTHING;
