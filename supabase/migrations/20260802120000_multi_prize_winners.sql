-- ============================================================
-- Ganador por premio (una rifa puede tener N premios y N ganadores)
--
-- Hasta ahora register_raffle_winner solo aceptaba UN ganador por rifa
-- (índice único sobre raffle_id). Ahora cada premio de la lista
-- (raffles.prizes, jsonb) puede tener su propio ganador. Compatibilidad
-- hacia atrás: una rifa SIN premios definidos (prizes = '[]', el caso de
-- todas las rifas reales hasta hoy) sigue funcionando exactamente igual
-- que antes — un solo ganador "de la rifa", sin premio específico.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Identidad estable por premio dentro del jsonb.
--
-- Los premios no son una tabla aparte (son descriptivos, ver migración
-- 20260724120000), así que para poder referenciar "el ganador de ESTE
-- premio" cada elemento necesita un id propio. normalize_raffle_prizes()
-- sigue siendo el validador puro (declarado immutable); asignar ids es un
-- paso aparte porque generar un uuid nuevo no es una operación immutable.
-- ------------------------------------------------------------

create or replace function public.assign_prize_ids(p_prizes jsonb)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      case
        when elem ? 'id'
          and (elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then elem
        else elem || jsonb_build_object('id', gen_random_uuid()::text)
      end
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_prizes) with ordinality as t(elem, ord);
$$;

comment on function public.assign_prize_ids(jsonb)
  is 'Asigna un id uuid estable a cada premio que no lo tenga ya (preserva los existentes). Se usa en create_raffle/update_raffle después de normalize_raffle_prizes.';

-- Rifas ya existentes: sus premios (si tienen) quedan con id desde ya.
update public.raffles
  set prizes = public.assign_prize_ids(prizes)
  where jsonb_array_length(prizes) > 0;


-- ------------------------------------------------------------
-- 2) create_raffle / update_raffle: mismo cuerpo, ahora asignan id.
--    Misma firma exacta -> CREATE OR REPLACE alcanza, sin drop.
-- ------------------------------------------------------------

create or replace function public.create_raffle(
  p_admin_user_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz,
  p_image_path text default null,
  p_prizes jsonb default '[]'::jsonb
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles;
  v_name text := trim(coalesce(p_name, ''));
  v_description text :=
    nullif(trim(coalesce(p_description, '')), '');
  v_image_path text :=
    nullif(trim(coalesce(p_image_path, '')), '');
  v_prizes jsonb :=
    public.assign_prize_ids(public.normalize_raffle_prizes(p_prizes));
begin
  perform public.assert_active_admin(p_admin_user_id);

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT' using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;

  if p_ticket_price is null or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = '22023';
  end if;

  if p_total_tickets is null or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS' using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH' using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception 'CLOSES_AT_MUST_BE_AFTER_STARTS_AT' using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception 'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT' using errcode = '22023';
  end if;

  insert into public.raffles (
    name, description, status, ticket_price, total_tickets,
    starts_at, closes_at, draw_at, image_path, prizes, created_by
  )
  values (
    v_name, v_description, 'draft', p_ticket_price, p_total_tickets,
    p_starts_at, p_closes_at, p_draw_at, v_image_path, v_prizes, p_admin_user_id
  )
  returning * into v_raffle;

  return v_raffle;
end;
$$;

create or replace function public.update_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz,
  p_prizes jsonb default '[]'::jsonb
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.raffles;
  v_updated public.raffles;
  v_name text := trim(coalesce(p_name, ''));
  v_description text :=
    nullif(trim(coalesce(p_description, '')), '');
  v_prizes jsonb :=
    public.assign_prize_ids(public.normalize_raffle_prizes(p_prizes));
  v_max_assigned_ticket integer;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current.status not in ('draft', 'active') then
    raise exception 'RAFFLE_NOT_EDITABLE' using errcode = '55000';
  end if;

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT' using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;

  if p_ticket_price is null or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = '22023';
  end if;

  if p_total_tickets is null or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS' using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH' using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception 'CLOSES_AT_MUST_BE_AFTER_STARTS_AT' using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception 'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT' using errcode = '22023';
  end if;

  if p_ticket_price <> v_current.ticket_price
     and exists (
       select 1
       from public.purchase_requests pr
       where pr.raffle_id = p_raffle_id
     ) then
    raise exception 'TICKET_PRICE_LOCKED' using errcode = '55000';
  end if;

  select max(t.ticket_number)
  into v_max_assigned_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id;

  if v_max_assigned_ticket is not null
     and p_total_tickets < v_max_assigned_ticket then
    raise exception 'TOTAL_TICKETS_BELOW_ASSIGNED_MAX' using errcode = '22023';
  end if;

  update public.raffles
  set
    name = v_name,
    description = v_description,
    ticket_price = p_ticket_price,
    total_tickets = p_total_tickets,
    starts_at = p_starts_at,
    closes_at = p_closes_at,
    draw_at = p_draw_at,
    prizes = v_prizes
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;
end;
$$;

comment on function public.update_raffle(uuid, uuid, text, text, numeric, integer, timestamptz, timestamptz, timestamptz, jsonb)
  is 'Actualiza una rifa en borrador o activa. Reescrita en 20260802120000 solo para asignar id a los premios (v_prizes); el resto del cuerpo es idéntico al de 20260724120000.';


-- ------------------------------------------------------------
-- 3) raffle_winners: soporta N filas por rifa (una por premio).
-- ------------------------------------------------------------

alter table public.raffle_winners
  add column if not exists prize_id uuid,
  add column if not exists prize_title text,
  add column if not exists prize_image_path text;

comment on column public.raffle_winners.prize_id
  is 'id del premio dentro de raffles.prizes (jsonb). NULL cuando la rifa no desglosa premios: significa "ganador de la rifa", sin premio específico.';
comment on column public.raffle_winners.prize_title
  is 'Copia congelada del título del premio al momento de registrar el ganador (inmutable, igual que el resto de la fila).';

alter table public.raffle_winners
  drop constraint if exists raffle_winners_raffle_unique;

-- Un ganador por premio concreto...
create unique index if not exists raffle_winners_raffle_prize_unique
  on public.raffle_winners (raffle_id, prize_id)
  where prize_id is not null;

-- ...o, si la rifa no tiene premios desglosados, un solo ganador "general".
create unique index if not exists raffle_winners_raffle_no_prize_unique
  on public.raffle_winners (raffle_id)
  where prize_id is null;

-- raffle_winners_ticket_unique (unique sobre ticket_id) se mantiene tal
-- cual: un ticket no puede ganar dos veces, ni el mismo premio ni otro.


-- ------------------------------------------------------------
-- 4) register_raffle_winner: gana un parámetro (p_prize_id). Cambia la
--    firma -> hay que eliminar la versión de 3 argumentos primero.
-- ------------------------------------------------------------

drop function if exists public.register_raffle_winner(uuid, uuid, integer);

create or replace function public.register_raffle_winner(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_ticket_number integer,
  p_prize_id uuid default null
)
returns public.raffle_winners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_ticket public.tickets%rowtype;
  v_winner public.raffle_winners%rowtype;
  v_prize jsonb;
  v_prize_title text;
  v_prize_image_path text;
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_ticket_number is null or p_ticket_number <= 0 then
    raise exception 'INVALID_TICKET_NUMBER' using errcode = '22023';
  end if;

  select r.* into v_raffle
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'closed' then
    raise exception 'RAFFLE_NOT_CLOSED' using errcode = 'P0001';
  end if;

  -- Resuelve el premio: obligatorio si la rifa desglosa premios,
  -- prohibido si no (mantiene el comportamiento "un solo ganador").
  if jsonb_array_length(v_raffle.prizes) = 0 then
    if p_prize_id is not null then
      raise exception 'PRIZE_ID_NOT_ALLOWED' using errcode = '22023';
    end if;
  else
    if p_prize_id is null then
      raise exception 'PRIZE_ID_REQUIRED' using errcode = '22023';
    end if;

    select elem
    into v_prize
    from jsonb_array_elements(v_raffle.prizes) elem
    where (elem->>'id')::uuid = p_prize_id;

    if v_prize is null then
      raise exception 'PRIZE_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_prize_title := v_prize->>'title';
    v_prize_image_path := nullif(v_prize->>'image_path', '');
  end if;

  if p_prize_id is not null then
    if exists (
      select 1 from public.raffle_winners w
      where w.raffle_id = p_raffle_id and w.prize_id = p_prize_id
    ) then
      raise exception 'PRIZE_ALREADY_HAS_WINNER' using errcode = 'P0001';
    end if;
  else
    if exists (
      select 1 from public.raffle_winners w
      where w.raffle_id = p_raffle_id and w.prize_id is null
    ) then
      raise exception 'RAFFLE_ALREADY_HAS_WINNER' using errcode = 'P0001';
    end if;
  end if;

  select t.* into v_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id
    and t.ticket_number = p_ticket_number;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.raffle_winners w where w.ticket_id = v_ticket.id
  ) then
    raise exception 'TICKET_ALREADY_WINNER' using errcode = 'P0001';
  end if;

  insert into public.raffle_winners (
    raffle_id, ticket_id, prize_id, prize_title, prize_image_path, confirmed_by
  )
  values (
    p_raffle_id, v_ticket.id, p_prize_id, v_prize_title, v_prize_image_path, p_admin_user_id
  )
  returning * into v_winner;

  return v_winner;
end;
$$;

revoke all
  on function public.register_raffle_winner(uuid, uuid, integer, uuid)
  from public, anon, authenticated;

grant execute
  on function public.register_raffle_winner(uuid, uuid, integer, uuid)
  to service_role;

comment on function public.register_raffle_winner(uuid, uuid, integer, uuid)
  is 'Registra un ganador irreversible para una rifa cerrada. p_prize_id identifica el premio (obligatorio si la rifa tiene premios desglosados, prohibido si no). Uso exclusivo del backend.';


-- ------------------------------------------------------------
-- 5) get_public_ticket_document: una fila POR TICKET (antes agrupaba en
--    un array por solicitud+estado). Necesario porque el estado de
--    "ganador" es por ticket individual, no por grupo. Agrega is_winner
--    y prize_title.
-- ------------------------------------------------------------

drop function if exists public.get_public_ticket_document(text, text, text);

create or replace function public.get_public_ticket_document(
  p_document_type text,
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_id uuid,
  raffle_name text,
  raffle_status public.raffle_status,
  full_name text,
  dni text,
  purchased_at timestamptz,
  ticket_status public.ticket_lifecycle_status,
  ticket_number integer,
  ticket_price numeric,
  requested_quantity integer,
  is_winner boolean,
  prize_title text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pr.id,
    r.id,
    r.name,
    r.status,
    pr.full_name,
    pr.dni,
    pr.created_at,
    t.ticket_status,
    t.ticket_number,
    r.ticket_price,
    pr.requested_quantity,
    (rw.id is not null),
    rw.prize_title
  from public.purchase_requests pr
  join public.tickets t on t.purchase_request_id = pr.id
  join public.raffles r on r.id = t.raffle_id
  left join public.raffle_winners rw on rw.ticket_id = t.id
  where pr.document_type = lower(trim(p_document_type))::public.participant_document_type
    and public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and pr.status = 'approved'
    and (
      exists (
        select 1
        from public.participant_tracking_codes ptc
        where ptc.document_type = pr.document_type
          and ptc.document_number = public.normalize_document_number(pr.dni)
          and ptc.tracking_code = public.normalize_tracking_code(p_tracking_code)
      )
      or exists (
        select 1
        from public.participant_tracking_code_aliases ptca
        where ptca.document_type = pr.document_type
          and ptca.document_number = public.normalize_document_number(pr.dni)
          and ptca.tracking_code = public.normalize_tracking_code(p_tracking_code)
      )
    )
  order by pr.created_at desc, r.name, t.ticket_number;
$$;

revoke all
  on function public.get_public_ticket_document(text, text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text, text)
  to service_role;
