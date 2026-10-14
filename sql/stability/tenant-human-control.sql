BEGIN;
CREATE TABLE IF NOT EXISTS public.whatsapp_human_control (
 loja_id uuid NOT NULL,configuracao_id uuid NOT NULL,session_id text NOT NULL,contato text NOT NULL,
 pausado boolean NOT NULL DEFAULT false,ultima_atividade_em timestamptz NOT NULL,atualizado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(loja_id,configuracao_id,session_id,contato),
 FOREIGN KEY(configuracao_id,loja_id) REFERENCES public.whatsapp_configuracoes(id,loja_id),
 CHECK(length(session_id) BETWEEN 1 AND 255),CHECK(length(contato) BETWEEN 1 AND 128)
);
ALTER TABLE public.whatsapp_human_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_human_control FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.whatsapp_human_control TO service_role;
COMMIT;
