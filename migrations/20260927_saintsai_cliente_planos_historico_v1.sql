-- SaintsAI: histórico detalhado de cobranças da assinatura.
alter table public.cobrancas_assinaturas
  add column if not exists valor_centavos integer null,
  add column if not exists duracao_meses integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='cobrancas_assinaturas_valor_centavos_check'
      and conrelid='public.cobrancas_assinaturas'::regclass
  ) then
    alter table public.cobrancas_assinaturas
      add constraint cobrancas_assinaturas_valor_centavos_check
      check (valor_centavos is null or valor_centavos >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='cobrancas_assinaturas_duracao_meses_check'
      and conrelid='public.cobrancas_assinaturas'::regclass
  ) then
    alter table public.cobrancas_assinaturas
      add constraint cobrancas_assinaturas_duracao_meses_check
      check (duracao_meses is null or duracao_meses in (1,3,6,12));
  end if;
end $$;
