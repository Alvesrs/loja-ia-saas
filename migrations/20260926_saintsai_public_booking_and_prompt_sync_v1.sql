-- SaintsAI: agendamento público seguro + Prompt Mestre operacional sincronizado
-- Aplicada em produção via Supabase em 2026-09-26.

create table if not exists public.saintsai_agenda_links (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  token_hash text not null unique,
  contato text not null,
  cliente_nome text null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz null,
  ultimo_acesso_em timestamptz null,
  constraint saintsai_agenda_links_contato_check check (char_length(contato) between 5 and 128),
  constraint saintsai_agenda_links_hash_check check (char_length(token_hash) = 64)
);

create index if not exists saintsai_agenda_links_loja_expira_idx
  on public.saintsai_agenda_links(loja_id, expira_em desc);

alter table public.saintsai_agenda_links enable row level security;
revoke all on table public.saintsai_agenda_links from anon, authenticated;

alter table public.saintsai_agendamentos
  add column if not exists pagamento_confirmacao_enviada_em timestamptz null;

create or replace function public.saintsai_sync_prompt_operacional(p_loja_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_prompt text; v_base text; v_ini int; v_fim_rel int; v_fim int;
  v_servicos text; v_agenda text; v_pag text; v_bloco text;
  v_cfg public.saintsai_agenda_config%rowtype;
  v_pc public.saintsai_pagamento_config%rowtype;
begin
  select nome, coalesce(prompt_mestre,'') into v_nome, v_prompt
  from public.lojas where id = p_loja_id;
  if not found then return; end if;

  v_base := v_prompt;
  v_ini := strpos(v_base, '[SAINTSAI_DADOS_NEGOCIO]');
  if v_ini > 0 then
    v_fim_rel := strpos(substring(v_base from v_ini), '[/SAINTSAI_DADOS_NEGOCIO]');
    if v_fim_rel > 0 then
      v_fim := v_ini + v_fim_rel - 1 + char_length('[/SAINTSAI_DADOS_NEGOCIO]');
      v_base := btrim(substring(v_base from 1 for v_ini - 1) || E'\n' || substring(v_base from v_fim + 1));
    end if;
  end if;

  select coalesce(string_agg(
    '- ' || nome || ' | preço: R$ ' || trim(to_char(preco, 'FM999999990D00')) ||
    ' | duração: ' || duracao_min || ' min' ||
    case when intervalo_pos_min > 0 then ' | intervalo após: ' || intervalo_pos_min || ' min' else '' end ||
    case when descricao is not null and btrim(descricao) <> '' then ' | detalhes: ' || btrim(descricao) else '' end,
    E'\n' order by nome
  ), '- Nenhum item ou serviço ativo cadastrado.')
  into v_servicos
  from public.saintsai_servicos
  where loja_id = p_loja_id and ativo = true;

  select * into v_cfg from public.saintsai_agenda_config where loja_id = p_loja_id;
  if found then
    select coalesce(string_agg(
      case e.key when '0' then 'Domingo' when '1' then 'Segunda-feira' when '2' then 'Terça-feira'
      when '3' then 'Quarta-feira' when '4' then 'Quinta-feira' when '5' then 'Sexta-feira'
      when '6' then 'Sábado' else 'Dia ' || e.key end ||
      ': ' || coalesce(e.value->>'inicio','?') || '–' || coalesce(e.value->>'fim','?'),
      E'\n' order by e.key
    ), 'Nenhum dia aberto.')
    into v_agenda
    from jsonb_each(v_cfg.horarios) e
    where coalesce((e.value->>'aberto')::boolean,false) = true;
    v_agenda := v_agenda || E'\nIntervalo da grade: ' || v_cfg.intervalo_grade_min || ' min. Fuso: ' || v_cfg.timezone || '.';
  else
    v_agenda := 'Agenda ainda não configurada.';
  end if;

  select * into v_pc from public.saintsai_pagamento_config where loja_id = p_loja_id;
  if found then
    v_pag := 'Aceitos: ' || coalesce(nullif(concat_ws(', ',
      case when v_pc.aceita_dinheiro then 'dinheiro' end,
      case when v_pc.aceita_pix_presencial then 'Pix presencial' end,
      case when v_pc.aceita_cartao_presencial then 'cartão presencial' end,
      case when v_pc.aceita_pix_online and v_pc.conectado then 'Pix online' end
    ),''),'nenhuma forma configurada') || '.';
    if v_pc.exige_pagamento_antecipado then v_pag := v_pag || ' Pagamento antecipado é obrigatório.'; end if;
    if v_pc.provedor is not null then
      v_pag := v_pag || ' Provedor online: ' || v_pc.provedor ||
        case when v_pc.conectado then ' (conectado).' else ' (não conectado).' end;
    end if;
  else
    v_pag := 'Configuração de pagamentos ainda não informada.';
  end if;

  v_bloco := '[SAINTSAI_DADOS_NEGOCIO]' || E'\n' ||
    'DADOS OPERACIONAIS SINCRONIZADOS AUTOMATICAMENTE. Não invente valores, serviços ou horários fora deste bloco.' || E'\n' ||
    'EMPRESA: ' || coalesce(v_nome,'') || E'\n\nITENS E SERVIÇOS:\n' || v_servicos ||
    E'\n\nAGENDA:\n' || v_agenda || E'\n\nPAGAMENTOS:\n' || v_pag ||
    E'\n\nREGRA: quando houver conflito entre dados antigos do prompt e este bloco, use os dados deste bloco para preço, duração, disponibilidade, agenda e formas de pagamento.' ||
    E'\n[/SAINTSAI_DADOS_NEGOCIO]';

  update public.lojas
  set prompt_mestre = case when btrim(v_base) = '' then v_bloco else btrim(v_base) || E'\n\n' || v_bloco end
  where id = p_loja_id;
end;
$$;

create or replace function public.saintsai_sync_prompt_operacional_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.saintsai_sync_prompt_operacional(coalesce(new.loja_id, old.loja_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists saintsai_servicos_sync_prompt on public.saintsai_servicos;
create trigger saintsai_servicos_sync_prompt after insert or update or delete on public.saintsai_servicos
for each row execute function public.saintsai_sync_prompt_operacional_trigger();

drop trigger if exists saintsai_pagamento_sync_prompt on public.saintsai_pagamento_config;
create trigger saintsai_pagamento_sync_prompt after insert or update or delete on public.saintsai_pagamento_config
for each row execute function public.saintsai_sync_prompt_operacional_trigger();

drop trigger if exists saintsai_agenda_sync_prompt on public.saintsai_agenda_config;
create trigger saintsai_agenda_sync_prompt after insert or update or delete on public.saintsai_agenda_config
for each row execute function public.saintsai_sync_prompt_operacional_trigger();
