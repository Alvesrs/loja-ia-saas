alter table public.gv_push_devices enable row level security;
alter table public.saintsai_push_devices enable row level security;
revoke all on table public.gv_push_devices, public.saintsai_push_devices from anon, authenticated;
grant select, insert, update, delete on table public.gv_push_devices, public.saintsai_push_devices to service_role;
