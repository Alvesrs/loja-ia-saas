-- Reviewed staging candidate. Do not execute against production automatically.
BEGIN;
CREATE TABLE IF NOT EXISTS public.whatsapp_batch_members (
 provedor text NOT NULL CHECK(provedor='waha'), id_externo text NOT NULL,
 job_id uuid NOT NULL REFERENCES public.whatsapp_fila_processamento(id),
 texto text NOT NULL CHECK(length(texto) BETWEEN 1 AND 12000),
 recebido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(provedor,id_externo)
);
ALTER TABLE public.whatsapp_batch_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_batch_members FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.whatsapp_batch_members TO service_role;
CREATE INDEX IF NOT EXISTS whatsapp_batch_members_job_idx ON public.whatsapp_batch_members(job_id);
CREATE OR REPLACE FUNCTION public.enqueue_waha_batch(p_loja uuid,p_config uuid,p_session text,p_contact text,p_text text,p_external text,p_timestamp timestamptz,p_window integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j uuid; old_text text; n timestamptz:=clock_timestamp();
BEGIN
 IF p_window IS NULL OR p_window NOT BETWEEN 10000 AND 15000 OR p_text IS NULL OR length(p_text) NOT BETWEEN 1 AND 12000
 OR coalesce(length(p_session),0) NOT BETWEEN 1 AND 255 OR coalesce(length(p_contact),0) NOT BETWEEN 1 AND 128
 OR coalesce(length(p_external),0) NOT BETWEEN 1 AND 512 THEN RAISE EXCEPTION 'invalid_batch_input'; END IF;
 -- Serialize only this tenant/configuration/contact; row locking also coordinates with claim.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_loja::text||':'||p_config::text||':'||p_session||':'||p_contact,0));
 SELECT job_id INTO j FROM public.whatsapp_batch_members WHERE provedor='waha' AND id_externo=p_external;
 IF j IS NOT NULL THEN RETURN j; END IF;
 SELECT id,texto INTO j,old_text FROM public.whatsapp_fila_processamento
 WHERE loja_id=p_loja AND configuracao_id=p_config AND destinatario_id=p_session AND contato=p_contact
 AND provedor='waha' AND status='pendente' AND tentativas=0 AND proxima_tentativa_em>n
 AND length(texto)+length(p_text)+1<=12000
 ORDER BY criado_em DESC,id DESC LIMIT 1 FOR UPDATE;
 IF j IS NULL THEN
 INSERT INTO public.whatsapp_fila_processamento(loja_id,configuracao_id,provedor,destinatario_id,contato,texto,id_externo,timestamp_mensagem,status,tentativas,lease_ate,proxima_tentativa_em)
 VALUES(p_loja,p_config,'waha',p_session,p_contact,p_text,p_external,p_timestamp,'pendente',0,NULL,n+p_window*interval '1 millisecond') RETURNING id INTO j;
 ELSE
 UPDATE public.whatsapp_fila_processamento SET texto=CASE WHEN EXISTS(SELECT 1 FROM public.whatsapp_batch_members WHERE job_id=j AND lower(regexp_replace(trim(texto),'\s+',' ','g'))=lower(regexp_replace(trim(p_text),'\s+',' ','g'))) THEN old_text ELSE old_text||E'\n'||p_text END,
 proxima_tentativa_em=n+p_window*interval '1 millisecond',atualizado_em=n WHERE id=j;
 END IF;
 INSERT INTO public.whatsapp_batch_members(provedor,id_externo,job_id,texto) VALUES('waha',p_external,j,p_text);
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_waha_batch(uuid,uuid,text,text,text,text,timestamptz,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_waha_batch(uuid,uuid,text,text,text,text,timestamptz,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_waha_batch_members()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status='concluido' AND OLD.status IS DISTINCT FROM NEW.status THEN
 UPDATE public.whatsapp_eventos_processados e SET status='concluido',processado_em=clock_timestamp()
 FROM public.whatsapp_batch_members m WHERE m.job_id=NEW.id AND e.provedor=m.provedor AND e.id_externo=m.id_externo;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finish_waha_batch_members() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_waha_batch_members() TO service_role;
DROP TRIGGER IF EXISTS finish_waha_batch_members ON public.whatsapp_fila_processamento;
CREATE TRIGGER finish_waha_batch_members AFTER UPDATE OF status ON public.whatsapp_fila_processamento
FOR EACH ROW EXECUTE FUNCTION public.finish_waha_batch_members();
COMMIT;
