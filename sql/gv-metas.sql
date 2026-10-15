-- Applied using Supabase migration gv_metas_mensais.
create table if not exists public.gv_metas (
  empresa_id uuid not null references public.gv_empresas(id),
  mes text not null check (mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  valor numeric(14,2) not null check (valor >= 0),
  primary key (empresa_id, mes)
);
alter table public.gv_metas enable row level security;
revoke all on public.gv_metas from anon, authenticated;
grant all on public.gv_metas to service_role;
