-- E2E: impede duas reservas ativas do mesmo cliente para o mesmo horário.
create unique index if not exists saintsai_agendamentos_cliente_horario_unico
on public.saintsai_agendamentos(loja_id, cliente_whatsapp, inicio)
where status <> 'cancelado';
