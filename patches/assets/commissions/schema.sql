alter table public.saintsai_profissionais add column comissao_tipo text not null default 'nenhuma' check (comissao_tipo in ('nenhuma','percentual','fixa')), add column comissao_valor numeric(12,2) not null default 0 check (comissao_valor>=0 and (comissao_tipo<>'percentual' or comissao_valor<=100));
alter table public.saintsai_agendamentos add column comissao_tipo text not null default 'nenhuma', add column comissao_taxa numeric(12,2) not null default 0, add column comissao_registrada boolean not null default false;
create table public.saintsai_comissao_repasses (agendamento_id uuid primary key references public.saintsai_agendamentos(id),loja_id uuid not null references public.lojas(id),profissional_id uuid not null references public.saintsai_profissionais(id),valor numeric(12,2) not null check(valor>0),registrado_em timestamptz not null default now(),registrado_por uuid not null references auth.users(id));
alter table public.saintsai_comissao_repasses enable row level security;
revoke all on public.saintsai_comissao_repasses from public,anon,authenticated;
grant select,insert on public.saintsai_comissao_repasses to service_role;
create function public.saintsai_snapshot_comissao() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' or (new.profissional_id is distinct from old.profissional_id and old.status not in ('concluido','cancelado')) then
  new.comissao_tipo:='nenhuma'; new.comissao_taxa:=0; new.comissao_registrada:=true;
  select p.comissao_tipo,p.comissao_valor into new.comissao_tipo,new.comissao_taxa from public.saintsai_profissionais p where p.id=new.profissional_id and p.loja_id=new.loja_id;
  new.comissao_tipo:=coalesce(new.comissao_tipo,'nenhuma');new.comissao_taxa:=coalesce(new.comissao_taxa,0);
 else
  new.comissao_tipo:=old.comissao_tipo;new.comissao_taxa:=old.comissao_taxa;new.comissao_registrada:=old.comissao_registrada;
 end if;
 return new;
end $$;
create trigger saintsai_snapshot_comissao before insert or update on public.saintsai_agendamentos for each row execute function public.saintsai_snapshot_comissao();
revoke all on function public.saintsai_snapshot_comissao() from public,anon,authenticated;
grant execute on function public.saintsai_snapshot_comissao() to service_role;
create function public.saintsai_registrar_repasses(p_loja uuid,p_profissional uuid,p_inicio timestamptz,p_fim timestamptz,p_usuario uuid,p_valor numeric) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer; devido numeric;
begin
 if p_inicio is null or p_fim is null or p_valor is null or p_valor<=0 or p_fim<=p_inicio or p_fim-p_inicio>interval '367 days' then raise exception 'periodo_invalido';end if;
 if not exists(select 1 from public.lojas where id=p_loja and dono_id=p_usuario) then raise exception 'acesso_negado';end if;
 perform 1 from public.saintsai_agendamentos where loja_id=p_loja and profissional_id=p_profissional and inicio>=p_inicio and inicio<p_fim for update;
 select coalesce(sum(least(a.valor,round(case when a.comissao_tipo='percentual' then a.valor*a.comissao_taxa/100 when a.comissao_tipo='fixa' then a.comissao_taxa else 0 end,2))),0) into devido from public.saintsai_agendamentos a where a.loja_id=p_loja and a.profissional_id=p_profissional and a.inicio>=p_inicio and a.inicio<p_fim and a.status='concluido' and a.pagamento_status='pago' and a.comissao_registrada and a.comissao_taxa>0 and a.comissao_tipo<>'nenhuma' and not exists(select 1 from public.saintsai_comissao_repasses r where r.agendamento_id=a.id);
 if devido=0 then return 0;end if;
 if devido<>p_valor then raise exception 'valor_alterado_atualize';end if;
 insert into public.saintsai_comissao_repasses(agendamento_id,loja_id,profissional_id,valor,registrado_por)
 select id,loja_id,profissional_id,least(valor,round(case when comissao_tipo='percentual' then valor*comissao_taxa/100 when comissao_tipo='fixa' then comissao_taxa else 0 end,2)),p_usuario
 from public.saintsai_agendamentos where loja_id=p_loja and profissional_id=p_profissional and inicio>=p_inicio and inicio<p_fim and status='concluido' and pagamento_status='pago' and comissao_registrada and valor>0 and comissao_tipo<>'nenhuma' and comissao_taxa>0
 on conflict(agendamento_id) do nothing;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.saintsai_registrar_repasses(uuid,uuid,timestamptz,timestamptz,uuid,numeric) from public,anon,authenticated;
grant execute on function public.saintsai_registrar_repasses(uuid,uuid,timestamptz,timestamptz,uuid,numeric) to service_role;
