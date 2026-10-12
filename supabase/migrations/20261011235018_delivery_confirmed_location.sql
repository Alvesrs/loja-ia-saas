begin;
set local lock_timeout='5s';
alter table public.saintsai_delivery_sessions
 add column if not exists latitude double precision,
 add column if not exists longitude double precision,
 add column if not exists endereco_localizado text,
 add column if not exists local_confirmado boolean not null default false,
 add column if not exists candidatos jsonb not null default '[]'::jsonb,
 add column if not exists cliente_nome text,
 add column if not exists pedido_id uuid;
alter table public.saintsai_delivery_orders
 add column if not exists endereco_localizado text,
 add column if not exists local_confirmado boolean not null default false;
alter table public.saintsai_delivery_sessions add constraint delivery_session_confirmed_point check
 (not local_confirmado or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180));
alter table public.saintsai_delivery_orders add constraint delivery_order_confirmed_point check
 (not local_confirmado or (modalidade='entrega' and latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180));
commit;
