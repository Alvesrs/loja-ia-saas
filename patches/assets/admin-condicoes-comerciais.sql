CREATE TABLE IF NOT EXISTS public.saintsai_condicoes_comerciais (
 loja_id uuid PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
 plano text NOT NULL CHECK (plano IN ('basico','pro','ilimitado')),
 preco_mensal_centavos integer NOT NULL CHECK (preco_mensal_centavos BETWEEN 1 AND 100000000),
 definido_por uuid NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saintsai_condicoes_comerciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saintsai_condicoes_comerciais FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saintsai_condicoes_comerciais TO service_role;
