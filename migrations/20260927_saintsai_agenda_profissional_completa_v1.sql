-- SaintsAI: pausas recorrentes, bloqueios/folgas/férias/feriados e no-show.
alter table public.saintsai_profissionais
  add column if not exists pausas jsonb null;

create table if not exists public.saintsai_agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  profissional_id uuid null references public.saintsai_profissionais(id) on delete cascade,
  tipo text not null default 'bloqueio',
  titulo text null,
  inicio timestamptz not null,
  fim timestamptz not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint saintsai_agenda_bloqueios_periodo_check check (fim > inicio),
  constraint saintsai_agenda_bloqueios_tipo_check check (tipo in ('bloqueio','folga','ferias','feriado'))
);

create index if not exists saintsai_agenda_bloqueios_loja_periodo_idx
  on public.saintsai_agenda_bloqueios(loja_id,inicio,fim)
  where ativo=true;

create index if not exists saintsai_agenda_bloqueios_profissional_idx
  on public.saintsai_agenda_bloqueios(loja_id,profissional_id,inicio)
  where ativo=true;

alter table public.saintsai_agenda_bloqueios enable row level security;
revoke all on table public.saintsai_agenda_bloqueios from anon, authenticated;

alter table public.saintsai_agendamentos
  add column if not exists nao_compareceu_em timestamptz null;

alter table public.saintsai_agendamentos
  drop constraint if exists saintsai_agendamentos_status_check;

alter table public.saintsai_agendamentos
  add constraint saintsai_agendamentos_status_check
  check (status in ('pendente','confirmado','em_atendimento','concluido','cancelado','nao_compareceu'));

create or replace function public.saintsai_touch_agenda_bloqueio()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists saintsai_agenda_bloqueios_touch on public.saintsai_agenda_bloqueios;
create trigger saintsai_agenda_bloqueios_touch
before update on public.saintsai_agenda_bloqueios
for each row execute function public.saintsai_touch_agenda_bloqueio();

revoke all on function public.saintsai_touch_agenda_bloqueio() from public, anon, authenticated;
grant execute on function public.saintsai_touch_agenda_bloqueio() to service_role;
