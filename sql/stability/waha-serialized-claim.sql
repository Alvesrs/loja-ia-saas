-- Staging candidate; used only when durable WAHA processing is enabled.
BEGIN;
CREATE OR REPLACE FUNCTION public.claim_whatsapp_job_serialized(p_lease_segundos integer DEFAULT 180)
RETURNS SETOF public.whatsapp_fila_processamento LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE candidate public.whatsapp_fila_processamento; n timestamptz:=clock_timestamp();
BEGIN
 IF p_lease_segundos IS NULL OR p_lease_segundos NOT BETWEEN 10 AND 3600 THEN RAISE EXCEPTION 'LEASE_INVALIDA'; END IF;
 FOR candidate IN SELECT q.* FROM public.whatsapp_fila_processamento q
 WHERE (q.status='pendente' AND q.proxima_tentativa_em<=n)
 OR (q.status='processando' AND q.lease_ate<=n)
 OR (q.status='enviado' AND q.proxima_tentativa_em<=n AND (q.lease_ate IS NULL OR q.lease_ate<=n))
 ORDER BY q.proxima_tentativa_em,q.criado_em,q.id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(candidate.loja_id::text||':'||candidate.configuracao_id::text||':'||candidate.destinatario_id||':'||candidate.contato,0)) THEN CONTINUE; END IF;
 IF EXISTS(SELECT 1 FROM public.whatsapp_fila_processamento busy WHERE busy.id<>candidate.id AND busy.loja_id=candidate.loja_id AND busy.configuracao_id=candidate.configuracao_id AND busy.destinatario_id=candidate.destinatario_id AND busy.contato=candidate.contato AND busy.status IN ('processando','enviado') AND busy.lease_ate>clock_timestamp()) THEN CONTINUE; END IF;
 RETURN QUERY UPDATE public.whatsapp_fila_processamento q SET status=CASE WHEN q.status='enviado' THEN 'enviado' ELSE 'processando' END,tentativas=q.tentativas+1,lease_ate=clock_timestamp()+p_lease_segundos*interval '1 second',atualizado_em=clock_timestamp() WHERE q.id=candidate.id RETURNING q.*;
 RETURN;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_job_serialized(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_job_serialized(integer) TO service_role;
COMMIT;
