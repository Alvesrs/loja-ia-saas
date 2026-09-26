-- Segurança: sincronização operacional do Prompt Mestre é somente backend.
revoke all on function public.saintsai_sync_prompt_operacional(uuid) from public, anon, authenticated;
grant execute on function public.saintsai_sync_prompt_operacional(uuid) to service_role;

revoke all on function public.saintsai_sync_prompt_operacional_trigger() from public, anon, authenticated;
grant execute on function public.saintsai_sync_prompt_operacional_trigger() to service_role;
