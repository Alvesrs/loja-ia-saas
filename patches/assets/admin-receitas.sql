CREATE TABLE IF NOT EXISTS public.saintsai_receitas_planos (
 pagamento_id text NOT NULL, ambiente text NOT NULL CHECK (ambiente IN ('production','sandbox')),
 cliente_id uuid NOT NULL, loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL, plano text NOT NULL,
 valor_centavos bigint NOT NULL CHECK(valor_centavos>=0), estornado_centavos bigint NOT NULL DEFAULT 0 CHECK(estornado_centavos>=0),
 status text NOT NULL, pago_em timestamptz NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(pagamento_id,ambiente)
);
ALTER TABLE public.saintsai_receitas_planos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saintsai_receitas_planos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.saintsai_receitas_planos TO service_role;
CREATE INDEX IF NOT EXISTS saintsai_receitas_planos_loja_idx ON public.saintsai_receitas_planos(loja_id);
ALTER TABLE public.saintsai_receitas_planos ADD COLUMN IF NOT EXISTS cliente_id uuid;
UPDATE public.saintsai_receitas_planos SET cliente_id=loja_id WHERE cliente_id IS NULL;
ALTER TABLE public.saintsai_receitas_planos ALTER COLUMN cliente_id SET NOT NULL;
