-- Corrige o trigger para sincronizar também após DELETE sem acessar NEW inexistente.
create or replace function public.saintsai_sync_prompt_operacional_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_loja_id := old.loja_id;
  else
    v_loja_id := new.loja_id;
  end if;

  perform public.saintsai_sync_prompt_operacional(v_loja_id);
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.saintsai_sync_prompt_operacional_trigger() from public, anon, authenticated;
grant execute on function public.saintsai_sync_prompt_operacional_trigger() to service_role;
