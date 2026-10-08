create table public.saintsai_sales_onboarding (
 id uuid primary key default gen_random_uuid(),
 conversa_id uuid not null unique references public.saintsai_sales_conversations(id) on delete cascade,
 owner_store_id uuid not null references public.lojas(id) on delete cascade,
 customer_store_id uuid references public.lojas(id) on delete set null,
 customer_user_id uuid,
 phase text not null check (phase in ('briefing','offer','creating','payment_method','charging','awaiting_payment','active','declined','needs_owner')),
 plan text,
 payment_method text check (payment_method in ('pix','card')),
 duration_months integer check (duration_months=1),
 prospect jsonb not null default '{}'::jsonb,
 payment jsonb not null default '{}'::jsonb,
 due_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index sales_onboarding_owner_updated_idx on public.saintsai_sales_onboarding(owner_store_id,updated_at desc);
create index sales_onboarding_customer_idx on public.saintsai_sales_onboarding(customer_store_id) where customer_store_id is not null;
alter table public.saintsai_sales_onboarding enable row level security;
revoke all on public.saintsai_sales_onboarding from public,anon,authenticated;
grant all on public.saintsai_sales_onboarding to service_role;
comment on table public.saintsai_sales_onboarding is 'Private owner sales workflow. No plaintext temporary passwords. API enforces ownership.';

create function public.saintsai_provision_sales_account(p_onboarding uuid,p_store uuid,p_user uuid,p_name text,p_prompt text) returns uuid language plpgsql set search_path=public,pg_temp as $$
declare v_plan text;
begin
 select plan into v_plan from public.saintsai_sales_onboarding where id=p_onboarding and phase='creating' and customer_user_id=p_user for update;
 if v_plan is null then raise exception 'invalid provisioning state'; end if;
 insert into public.lojas(id,dono_id,nome,prompt_mestre,ativa) values(p_store,p_user,left(p_name,100),left(p_prompt,20000),true);
 insert into public.assinaturas(loja_id,plano,status,valido_ate,atualizado_em) values(p_store,v_plan,'inativo',null,now());
 update public.saintsai_sales_onboarding set customer_store_id=p_store,phase='payment_method',updated_at=now() where id=p_onboarding;
 return p_store;
end $$;
revoke all on function public.saintsai_provision_sales_account(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.saintsai_provision_sales_account(uuid,uuid,uuid,text,text) to service_role;
