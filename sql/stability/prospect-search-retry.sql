CREATE OR REPLACE FUNCTION public.saintsai_prospect_start(p_loja_id uuid,p_actor uuid,p_target jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid; v_created timestamptz; v_status text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_loja_id::text,98123));
 IF NOT EXISTS(SELECT 1 FROM public.lojas WHERE id=p_loja_id AND dono_id=p_actor) THEN
  RAISE EXCEPTION 'Esta loja não pertence à conta solicitante.';
 END IF;
 SELECT id,created_at,status INTO v_id,v_created,v_status FROM public.saintsai_prospect_batches b WHERE loja_id=p_loja_id AND NOT (status='failed' AND NOT EXISTS(SELECT 1 FROM public.saintsai_prospect_items i WHERE i.batch_id=b.id)) ORDER BY created_at DESC LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.saintsai_prospect_quota(p_loja_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH latest AS (SELECT b.created_at FROM public.saintsai_prospect_batches b WHERE b.loja_id=p_loja_id AND NOT(b.status='failed' AND NOT EXISTS(SELECT 1 FROM public.saintsai_prospect_items i WHERE i.batch_id=b.id)) ORDER BY b.created_at DESC LIMIT 1), quota AS (SELECT (SELECT created_at + interval '12 hours' FROM latest) AS renew_at)
 SELECT jsonb_build_object('limit',15,'renewAt',renew_at,'remainingMs',greatest(0,coalesce(extract(epoch FROM (renew_at-now()))*1000,0)),'available',renew_at IS NULL OR renew_at<=now()) FROM quota;
$$;
REVOKE ALL ON FUNCTION public.saintsai_prospect_quota(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saintsai_prospect_quota(uuid) TO service_role;
