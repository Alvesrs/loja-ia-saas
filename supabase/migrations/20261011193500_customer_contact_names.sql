create table if not exists public.saintsai_contatos_clientes (
 loja_id uuid not null references public.lojas(id) on delete cascade,
 contato text not null check (contato ~ '^[0-9]{8,20}$'),
 nome text not null check (char_length(nome) between 2 and 100),
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 primary key (loja_id, contato)
);
alter table public.saintsai_contatos_clientes enable row level security;
revoke all on public.saintsai_contatos_clientes from anon, authenticated;
grant all on public.saintsai_contatos_clientes to service_role;
