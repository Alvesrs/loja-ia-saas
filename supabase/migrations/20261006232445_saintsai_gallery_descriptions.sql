CREATE TABLE IF NOT EXISTS public.saintsai_galeria (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN ('foto','video')),
 descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 500),
 etiquetas text[] NOT NULL DEFAULT '{}' CHECK (cardinality(etiquetas)<=12),
 ativo boolean NOT NULL DEFAULT false,
 storage_bucket text NOT NULL DEFAULT 'saintsai-galeria' CHECK (storage_bucket IN ('saintsai-galeria','produto-imagens','servico-imagens','saintsai-videos')),
 arquivo_path text CHECK (arquivo_path IS NULL OR arquivo_path LIKE loja_id::text||'/%'),
 mime text CHECK (mime IS NULL OR mime IN ('image/jpeg','image/png','image/webp','video/mp4')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(loja_id,storage_bucket,arquivo_path)
);
CREATE INDEX IF NOT EXISTS saintsai_galeria_loja_tipo_idx ON public.saintsai_galeria(loja_id,tipo,criado_em DESC);
ALTER TABLE public.saintsai_galeria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saintsai_galeria FROM anon,authenticated;
GRANT SELECT ON public.saintsai_galeria TO authenticated;
GRANT ALL ON public.saintsai_galeria TO service_role;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='saintsai_galeria' AND policyname='galeria_dono_leitura') THEN
 CREATE POLICY galeria_dono_leitura ON public.saintsai_galeria FOR SELECT TO authenticated
 USING (loja_id IN (SELECT id FROM public.lojas WHERE dono_id=(SELECT auth.uid())));
END IF; END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('saintsai-galeria','saintsai-galeria',true,10485760,ARRAY['image/jpeg','image/png','image/webp','video/mp4'])
ON CONFLICT(id) DO NOTHING;
-- Importa referências existentes, sem copiar nem excluir arquivos do catálogo.
INSERT INTO public.saintsai_galeria(loja_id,tipo,descricao,etiquetas,ativo,storage_bucket,arquivo_path,mime)
SELECT loja_id,tipo,left(btrim(nome||CASE WHEN descricao IS NOT NULL AND btrim(descricao)<>'' THEN ' — '||descricao ELSE '' END),500),ARRAY[left(nome,60)],true,
 split_part(replace(url,'https://ldpiryzsunxwuhyvvogg.supabase.co/storage/v1/object/public/',''),'/',1),
 regexp_replace(replace(url,'https://ldpiryzsunxwuhyvvogg.supabase.co/storage/v1/object/public/',''),'^[^/]+/',''),
 CASE WHEN tipo='video' THEN 'video/mp4' WHEN url ~ '\.png$' THEN 'image/png' WHEN url ~ '\.webp$' THEN 'image/webp' ELSE 'image/jpeg' END
FROM (
 SELECT loja_id,nome,descricao,'foto'::text AS tipo,imagem_url AS url FROM public.produtos WHERE ativo=true
 UNION ALL SELECT loja_id,nome,descricao,'foto',imagem_url FROM public.saintsai_servicos WHERE ativo=true
 UNION ALL SELECT loja_id,nome,descricao,'video',video_url FROM public.produtos WHERE ativo=true
 UNION ALL SELECT loja_id,nome,descricao,'video',video_url FROM public.saintsai_servicos WHERE ativo=true
) fontes
WHERE url ~ ('^https://ldpiryzsunxwuhyvvogg\.supabase\.co/storage/v1/object/public/(produto-imagens|servico-imagens|saintsai-videos)/'||loja_id::text||'/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4)$')
AND nome IS NOT NULL AND btrim(nome)<>''
ON CONFLICT(loja_id,storage_bucket,arquivo_path) DO NOTHING;
ALTER TABLE public.whatsapp_fila_processamento ADD COLUMN IF NOT EXISTS galeria_envios jsonb NOT NULL DEFAULT '{}';
-- Checkpoint atômico: não repete arquivo já confirmado ou cuja entrega é incerta.
CREATE OR REPLACE FUNCTION public.saintsai_galeria_checkpoint(p_job uuid,p_loja uuid,p_indice integer,p_acao text,p_itens jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE g jsonb; estado text; m jsonb;
BEGIN
 IF p_indice IS NULL OR p_acao IS NULL OR p_indice<0 OR p_indice>2 OR p_acao NOT IN ('claim','ack','ignorado') THEN RAISE EXCEPTION 'checkpoint invalido'; END IF;
 SELECT galeria_envios INTO g FROM public.whatsapp_fila_processamento WHERE id=p_job AND loja_id=p_loja AND status='processando' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'fila indisponivel'; END IF;
 IF g->'itens' IS NULL THEN
  IF p_acao<>'claim' OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'selecao invalida'; END IF;
  g=jsonb_build_object('itens',p_itens,'estados','{}'::jsonb);
 END IF;
 m=g->'itens'->p_indice;
 IF m IS NULL THEN RETURN jsonb_build_object('enviar',false); END IF;
 estado=g->'estados'->>p_indice::text;
 IF p_acao='claim' THEN
  IF estado IS NOT NULL THEN RETURN jsonb_build_object('enviar',false,'midia',m,'estado',estado); END IF;
  g=jsonb_set(g,ARRAY['estados',p_indice::text],to_jsonb('enviando'::text));
 ELSE
  IF estado IS DISTINCT FROM 'enviando' THEN RAISE EXCEPTION 'envio nao reivindicado'; END IF;
  g=jsonb_set(g,ARRAY['estados',p_indice::text],to_jsonb(CASE WHEN p_acao='ack' THEN 'enviado' ELSE 'ignorado' END));
 END IF;
 UPDATE public.whatsapp_fila_processamento SET galeria_envios=g WHERE id=p_job AND loja_id=p_loja;
 RETURN jsonb_build_object('enviar',p_acao='claim','midia',m,'estado',g->'estados'->>p_indice::text);
END $$;
REVOKE ALL ON FUNCTION public.saintsai_galeria_checkpoint(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saintsai_galeria_checkpoint(uuid,uuid,integer,text,jsonb) TO service_role;
