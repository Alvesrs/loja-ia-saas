-- SaintsAI Dashboard polish: fotos em serviços e quantidade de profissionais.
alter table public.saintsai_servicos
  add column if not exists imagem_url text null,
  add column if not exists imagem_path text null;

alter table public.saintsai_agenda_config
  add column if not exists quantidade_profissionais integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='saintsai_agenda_config_quantidade_profissionais_check'
      and conrelid='public.saintsai_agenda_config'::regclass
  ) then
    alter table public.saintsai_agenda_config
      add constraint saintsai_agenda_config_quantidade_profissionais_check
      check (quantidade_profissionais between 0 and 100);
  end if;
end $$;
