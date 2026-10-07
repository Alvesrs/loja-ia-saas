create or replace function public.saintsai_delete_client_store(target_id uuid, expected_owner uuid)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform 1 from public.lojas where id=target_id and dono_id=expected_owner for update;
  if not found then return false; end if;
  delete from public.pedido_itens pi using public.pedidos p where pi.pedido_id=p.id and p.loja_id=target_id;
  delete from public.venda_itens where loja_id=target_id;
  delete from public.saintsai_sales_conversations where loja_id=target_id;
  delete from public.lojas where id=target_id and dono_id=expected_owner;
  return found;
end $$;
revoke all on function public.saintsai_delete_client_store(uuid,uuid) from public, anon, authenticated;
grant execute on function public.saintsai_delete_client_store(uuid,uuid) to service_role;
