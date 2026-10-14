-- Fifteen new conversations per store, renewable twelve hours after activation.
ALTER TABLE public.saintsai_prospect_batches DROP CONSTRAINT IF EXISTS saintsai_prospect_batches_limit_count_check;
ALTER TABLE public.saintsai_prospect_batches ADD CONSTRAINT saintsai_prospect_batches_limit_count_check CHECK(limit_count BETWEEN 1 AND 15);
ALTER TABLE public.saintsai_prospect_batches ALTER COLUMN limit_count SET DEFAULT 15;
ALTER TABLE public.saintsai_prospect_items DROP CONSTRAINT IF EXISTS saintsai_prospect_items_position_check;
ALTER TABLE public.saintsai_prospect_items ADD CONSTRAINT saintsai_prospect_items_position_check CHECK(position BETWEEN 0 AND 14);
CREATE OR REPLACE FUNCTION public.saintsai_prospect_start(p_loja_id uuid,p_actor uuid,p_target jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid; v_created timestamptz; v_status text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_loja_id::text,98123));
 IF NOT EXISTS(SELECT 1 FROM public.lojas WHERE id=p_loja_id AND dono_id=p_actor) THEN
  RAISE EXCEPTION 'Esta loja não pertence à conta solicitante.';
 END IF;
 SELECT id,created_at,status INTO v_id,v_created,v_status FROM public.saintsai_prospect_batches WHERE loja_id=p_loja_id ORDER BY created_at DESC LIMIT 1;
 IF v_created IS NOT NULL AND v_created + INTERVAL '12 hours' > now() THEN
  IF v_status IN ('searching','searching_claimed','running') THEN RETURN v_id; END IF;
  RAISE EXCEPTION 'A habilidade será renovada 12 horas após o início da última rodada.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.saintsai_prospect_items WHERE loja_id=p_loja_id AND status='sending') THEN
  RAISE EXCEPTION 'Aguarde o envio em andamento antes de iniciar outra rodada.';
 END IF;
 -- Retain all history; queued permission requests from an expired cycle do not send later.
 UPDATE public.saintsai_prospect_items SET status='cancelled',updated_at=now() WHERE loja_id=p_loja_id AND status='queued';
 UPDATE public.saintsai_prospect_batches SET status='cancelled',updated_at=now() WHERE loja_id=p_loja_id AND status IN ('searching','searching_claimed','running');
 INSERT INTO public.saintsai_prospect_batches(loja_id,started_by,target,limit_count) VALUES(p_loja_id,p_actor,p_target,15) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.saintsai_prospect_start(uuid,uuid,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saintsai_prospect_start(uuid,uuid,jsonb) TO service_role;
