create table public.saintsai_prospect_batches (
 id uuid primary key default gen_random_uuid(),loja_id uuid not null references public.lojas(id) on delete cascade,
 started_by uuid not null references auth.users(id),status text not null default 'searching' check(status in ('searching','searching_claimed','running','completed','cancelled','failed')),
 target jsonb not null,limit_count int not null default 5 check(limit_count between 1 and 5),error text,
 lease_until timestamptz,next_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index saintsai_prospect_one_batch on public.saintsai_prospect_batches(loja_id) where status in ('searching','searching_claimed','running');
create table public.saintsai_prospect_items (
 id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.saintsai_prospect_batches(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,phone text not null,contact text not null,position int not null check(position between 0 and 4),
 business jsonb not null,opening text not null,status text not null default 'queued' check(status in ('queued','sending','waiting','closed','uncertain','failed','cancelled')),
 result jsonb,error text,lease_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(loja_id,phone),unique(batch_id,position)
);
create index saintsai_prospect_items_batch on public.saintsai_prospect_items(batch_id,position);
create index saintsai_prospect_items_active on public.saintsai_prospect_items(loja_id,status);
alter table public.saintsai_prospect_batches enable row level security;
alter table public.saintsai_prospect_items enable row level security;
revoke all on public.saintsai_prospect_batches,public.saintsai_prospect_items from anon,authenticated;
grant select,insert,update,delete on public.saintsai_prospect_batches,public.saintsai_prospect_items to service_role;
create function public.saintsai_prospect_start(p_loja_id uuid,p_actor uuid,p_target jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_count int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_loja_id::text,98123));
 select id into v_id from public.saintsai_prospect_batches where loja_id=p_loja_id and status in ('searching','searching_claimed','running') limit 1;
 if found then return v_id;end if;
 select count(*) into v_count from public.saintsai_prospect_items where loja_id=p_loja_id and status in ('queued','sending','waiting','uncertain');
 if v_count>=5 then raise exception 'Já existem cinco conversas automáticas em andamento.';end if;
 insert into public.saintsai_prospect_batches(loja_id,started_by,target,limit_count) values(p_loja_id,p_actor,p_target,5-v_count) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.saintsai_prospect_start(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.saintsai_prospect_start(uuid,uuid,jsonb) to service_role;
