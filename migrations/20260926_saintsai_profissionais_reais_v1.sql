-- SaintsAI: profissionais reais por loja e agenda simultânea por profissional.
create table if not exists public.saintsai_profissionais (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  horarios jsonb null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint saintsai_profissionais_nome_check check (char_length(btrim(nome)) between 2 and 100)
);

create index if not exists saintsai_profissionais_loja_idx
  on public.saintsai_profissionais(loja_id, ativo, nome);

alter table public.saintsai_profissionais enable row level security;
revoke all on table public.saintsai_profissionais from anon, authenticated;

create table if not exists public.saintsai_profissional_servicos (
  profissional_id uuid not null references public.saintsai_profissionais(id) on delete cascade,
  servico_id uuid not null references public.saintsai_servicos(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (profissional_id, servico_id)
);

create index if not exists saintsai_profissional_servicos_loja_idx
  on public.saintsai_profissional_servicos(loja_id, servico_id);

alter table public.saintsai_profissional_servicos enable row level security;
revoke all on table public.saintsai_profissional_servicos from anon, authenticated;

alter table public.saintsai_agendamentos
  add column if not exists profissional_id uuid null references public.saintsai_profissionais(id) on delete set null;

create index if not exists saintsai_agendamentos_profissional_inicio_idx
  on public.saintsai_agendamentos(loja_id, profissional_id, inicio)
  where status <> 'cancelado';

alter table public.saintsai_agendamentos
  drop constraint if exists saintsai_agendamentos_sem_sobreposicao;

alter table public.saintsai_agendamentos
  add constraint saintsai_agendamentos_sem_sobreposicao
  exclude using gist (
    loja_id with =,
    coalesce(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    tstzrange(inicio, fim, '[)') with &&
  )
  where (status <> 'cancelado');

insert into public.saintsai_profissionais (loja_id,nome,ativo)
select a.loja_id, 'Profissional ' || g.n, true
from public.saintsai_agenda_config a
cross join lateral generate_series(1, least(greatest(a.quantidade_profissionais,0),20)) as g(n)
where a.quantidade_profissionais > 0
and not exists (
  select 1 from public.saintsai_profissionais p where p.loja_id=a.loja_id
);

create or replace function public.saintsai_sync_quantidade_profissionais()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_loja uuid;
  v_qtd integer;
begin
  v_loja := case when TG_OP='DELETE' then old.loja_id else new.loja_id end;
  select count(*)::integer into v_qtd
  from public.saintsai_profissionais
  where loja_id=v_loja and ativo=true;

  update public.saintsai_agenda_config
     set quantidade_profissionais=v_qtd,
         atualizado_em=now()
   where loja_id=v_loja;

  begin
    perform public.saintsai_sync_prompt_operacional(v_loja);
  exception when undefined_function then
    null;
  end;

  return case when TG_OP='DELETE' then old else new end;
end;
$$;

drop trigger if exists saintsai_profissionais_sync_qtd on public.saintsai_profissionais;
create trigger saintsai_profissionais_sync_qtd
after insert or update of ativo,nome,horarios or delete
on public.saintsai_profissionais
for each row execute function public.saintsai_sync_quantidade_profissionais();

revoke all on function public.saintsai_sync_quantidade_profissionais() from public, anon, authenticated;
grant execute on function public.saintsai_sync_quantidade_profissionais() to service_role;
