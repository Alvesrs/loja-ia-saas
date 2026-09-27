-- SaintsAI Dashboard financeiro: registra datas reais de pagamento, conclusão e cancelamento.
alter table public.saintsai_agendamentos
  add column if not exists pagamento_pago_em timestamptz null,
  add column if not exists cancelado_em timestamptz null,
  add column if not exists concluido_em timestamptz null;

create or replace function public.saintsai_agendamento_financeiro_timestamps()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.pagamento_status='pago'
     and (tg_op='INSERT' or old.pagamento_status is distinct from 'pago')
     and new.pagamento_pago_em is null then
    new.pagamento_pago_em := now();
  end if;

  if new.status='concluido'
     and (tg_op='INSERT' or old.status is distinct from 'concluido') then
    if new.concluido_em is null then new.concluido_em := now(); end if;
    if new.pagamento_status='presencial' and new.pagamento_pago_em is null then
      new.pagamento_pago_em := now();
    end if;
  end if;

  if new.status='cancelado'
     and (tg_op='INSERT' or old.status is distinct from 'cancelado')
     and new.cancelado_em is null then
    new.cancelado_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists saintsai_agendamento_financeiro_timestamps on public.saintsai_agendamentos;
create trigger saintsai_agendamento_financeiro_timestamps
before insert or update of status,pagamento_status
on public.saintsai_agendamentos
for each row execute function public.saintsai_agendamento_financeiro_timestamps();

update public.saintsai_agendamentos
set pagamento_pago_em=coalesce(pagamento_pago_em,atualizado_em,criado_em)
where pagamento_status='pago' and pagamento_pago_em is null;

update public.saintsai_agendamentos
set concluido_em=coalesce(concluido_em,atualizado_em,criado_em),
    pagamento_pago_em=case
      when pagamento_status='presencial' then coalesce(pagamento_pago_em,atualizado_em,criado_em)
      else pagamento_pago_em
    end
where status='concluido' and concluido_em is null;

update public.saintsai_agendamentos
set cancelado_em=coalesce(cancelado_em,atualizado_em,criado_em)
where status='cancelado' and cancelado_em is null;

revoke all on function public.saintsai_agendamento_financeiro_timestamps() from public, anon, authenticated;
grant execute on function public.saintsai_agendamento_financeiro_timestamps() to service_role;
