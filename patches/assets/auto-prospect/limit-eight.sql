alter table public.saintsai_prospect_batches drop constraint saintsai_prospect_batches_limit_count_check;
alter table public.saintsai_prospect_batches add constraint saintsai_prospect_batches_limit_count_check check(limit_count between 1 and 8);
alter table public.saintsai_prospect_batches alter column limit_count set default 8;
alter table public.saintsai_prospect_items drop constraint saintsai_prospect_items_position_check;
alter table public.saintsai_prospect_items add constraint saintsai_prospect_items_position_check check(position between 0 and 7);
create or replace function public.saintsai_prospect_start(p_loja_id uuid,p_actor uuid,p_target jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_count int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_loja_id::text,98123));
 select id into v_id from public.saintsai_prospect_batches where loja_id=p_loja_id and status in ('searching','searching_claimed','running') limit 1;
 if found then return v_id;end if;
 select count(*) into v_count from public.saintsai_prospect_items where loja_id=p_loja_id and status in ('queued','sending','waiting','uncertain');
 if v_count>=8 then raise exception 'Já existem oito conversas automáticas em andamento.';end if;
 insert into public.saintsai_prospect_batches(loja_id,started_by,target,limit_count) values(p_loja_id,p_actor,p_target,8-v_count) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.saintsai_prospect_start(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.saintsai_prospect_start(uuid,uuid,jsonb) to service_role;
