alter table public.saintsai_profissionais add column if not exists whatsapp_numero text;
alter table public.saintsai_profissionais add constraint professional_whatsapp_format check (whatsapp_numero is null or whatsapp_numero ~ '^55[1-9][0-9][0-9]{8,9}$');
create unique index professional_whatsapp_per_store on public.saintsai_profissionais(loja_id,whatsapp_numero) where whatsapp_numero is not null;
