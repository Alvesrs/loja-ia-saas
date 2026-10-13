create table if not exists public.saintsai_marketing_settings (
 loja_id uuid primary key references public.lojas(id) on delete cascade,
 auto_enabled boolean not null default true,
 strategy jsonb not null default '{}'::jsonb,
 icon_data text,
 niche text not null default 'barbearias',
 city text not null default '',
 updated_at timestamptz not null default now()
);
create table if not exists public.saintsai_marketing_reviews (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 conversa_id uuid not null references public.whatsapp_conversas(id) on delete cascade,
 fingerprint text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 unique(loja_id,conversa_id,fingerprint)
);
create index if not exists saintsai_marketing_reviews_recent on public.saintsai_marketing_reviews(loja_id,created_at desc);
create table if not exists public.saintsai_marketing_changes (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 before_strategy jsonb not null,
 after_strategy jsonb not null,
 reason text not null,
 reverted boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists saintsai_marketing_changes_recent on public.saintsai_marketing_changes(loja_id,created_at desc);
create table if not exists public.saintsai_marketing_content (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 kind text not null check(kind in ('chat','creative','plan','sources')),
 title text not null,
 data jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists saintsai_marketing_content_recent on public.saintsai_marketing_content(loja_id,created_at desc);
alter table public.saintsai_marketing_settings enable row level security;
alter table public.saintsai_marketing_reviews enable row level security;
alter table public.saintsai_marketing_changes enable row level security;
alter table public.saintsai_marketing_content enable row level security;
revoke all on public.saintsai_marketing_settings, public.saintsai_marketing_reviews, public.saintsai_marketing_changes, public.saintsai_marketing_content from anon,authenticated;
grant select,insert,update,delete on public.saintsai_marketing_settings, public.saintsai_marketing_reviews, public.saintsai_marketing_changes, public.saintsai_marketing_content to service_role;
create or replace function public.saintsai_marketing_apply_strategy(p_loja_id uuid,p_expected timestamptz,p_before jsonb,p_after jsonb,p_reason text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 update public.saintsai_marketing_settings set strategy=p_after,updated_at=now() where loja_id=p_loja_id and updated_at=p_expected and auto_enabled=true;
 if not found then return false; end if;
 insert into public.saintsai_marketing_changes(loja_id,before_strategy,after_strategy,reason) values(p_loja_id,p_before,p_after,p_reason);
 return true;
end;
$$;
create or replace function public.saintsai_marketing_undo_strategy(p_loja_id uuid,p_change_id uuid,p_expected timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_change public.saintsai_marketing_changes;
begin
 select * into v_change from public.saintsai_marketing_changes where id=p_change_id and loja_id=p_loja_id and reverted=false for update;
 if not found then return false; end if;
 update public.saintsai_marketing_settings set strategy=v_change.before_strategy,auto_enabled=false,updated_at=now() where loja_id=p_loja_id and updated_at=p_expected and strategy=v_change.after_strategy;
 if not found then return false; end if;
 update public.saintsai_marketing_changes set reverted=true where id=p_change_id;
 return true;
end;
$$;
revoke all on function public.saintsai_marketing_apply_strategy(uuid,timestamptz,jsonb,jsonb,text),public.saintsai_marketing_undo_strategy(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.saintsai_marketing_apply_strategy(uuid,timestamptz,jsonb,jsonb,text),public.saintsai_marketing_undo_strategy(uuid,uuid,timestamptz) to service_role;
