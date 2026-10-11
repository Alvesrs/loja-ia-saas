create table if not exists public.saintsai_notificacao_preferencias (
 loja_id uuid primary key references public.lojas(id) on delete cascade,
 som text not null default 'classico' check (som in ('classico','pix','moedas','caixa')),
 atualizado_em timestamptz not null default now()
);
alter table public.saintsai_notificacao_preferencias enable row level security;
revoke all on public.saintsai_notificacao_preferencias from anon, authenticated;
grant all on public.saintsai_notificacao_preferencias to service_role;
