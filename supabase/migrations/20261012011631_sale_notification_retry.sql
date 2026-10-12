alter table public.saintsai_agendamentos add column if not exists notificacao_venda_enfileirada boolean not null default false;
create table if not exists public.saintsai_sale_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 agendamento_id uuid not null references public.saintsai_agendamentos(id) on delete cascade,
 status text not null default 'pendente' check (status in ('pendente','processando','enviado','cancelado','falhou')),
 tentativas integer not null default 0,
 criado_em timestamptz not null default now(),
 proxima_tentativa_em timestamptz not null default now(),
 bloqueado_em timestamptz,
 bloqueio_id uuid,
 enviado_em timestamptz,
 ultimo_erro text,
 unique(agendamento_id)
);
alter table public.saintsai_sale_notification_outbox enable row level security;
revoke all on public.saintsai_sale_notification_outbox from anon,authenticated;
grant select,insert,update,delete on public.saintsai_sale_notification_outbox to service_role;
create index if not exists saintsai_sale_notification_pending on public.saintsai_sale_notification_outbox(proxima_tentativa_em) where status in ('pendente','processando');
create or replace function public.saintsai_queue_received_sale() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.notificacao_venda_enfileirada and new.pagamento_provider_status='PAYMENT_RECEIVED' and new.pagamento_status='pago' then
  insert into public.saintsai_sale_notification_outbox(loja_id,agendamento_id) values(new.loja_id,new.id) on conflict(agendamento_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.saintsai_queue_received_sale() from public,anon,authenticated;
grant execute on function public.saintsai_queue_received_sale() to service_role;
drop trigger if exists saintsai_queue_received_sale on public.saintsai_agendamentos;
create trigger saintsai_queue_received_sale after update of pagamento_provider_status,notificacao_venda_enfileirada on public.saintsai_agendamentos for each row execute function public.saintsai_queue_received_sale();
