-- ============================================================
-- Correcciones sobre la entrega de anulación (20260804190100/190200).
--
-- 1) admin_list_ticket_groups: la migración 20260804190200 se escribió
--    partiendo del cuerpo de 20260803195939 en vez del vigente
--    (20260803200000) y revirtió sin querer la búsqueda numérica:
--    volvió a exigir p_search Y p_ticket_number a la vez, cuando el panel
--    envía AMBOS al teclear un número suelto ("125" -> p_search='125' +
--    p_ticket_number=125). Resultado: cero resultados al buscar por número.
--    También se perdió la cota superior p_ticket_number > 1000000.
--    Aquí se restaura el cuerpo vigente y se le añade voided_count.
--
-- 2) void_purchase_request_tickets validaba el estado de la rifa apuntada
--    por purchase_requests.raffle_id, pero anula los tickets de la
--    solicitud vivan donde vivan. Tras una reasignación esos dos valores
--    divergen y la anulación quedaba bloqueada con un mensaje falso. Lo
--    que importa es la rifa donde el ticket participa HOY.
--
-- 3) tickets_purchase_request_status_idx era redundante: el índice
--    tickets_purchase_request_idx (purchase_request_id) del esquema
--    inicial ya sirve estas consultas (una solicitud tiene <= 50 tickets).
-- ============================================================

drop index if exists public.tickets_purchase_request_status_idx;


-- ------------------------------------------------------------
-- 1) Búsqueda por nombre/DNI/teléfono O por número de ticket (no AND),
--    con voided_count añadido.
-- ------------------------------------------------------------
drop function if exists public.admin_list_ticket_groups(
  uuid, text, public.ticket_lifecycle_status, date, date, text, integer, integer, integer
);

create or replace function public.admin_list_ticket_groups(
  p_raffle_id uuid default null,
  p_period text default 'all',
  p_ticket_status public.ticket_lifecycle_status default null,
  p_date_from date default null,
  p_date_to date default null,
  p_search text default null,
  p_ticket_number integer default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  purchase_request_id uuid,
  raffle_id uuid,
  raffle_name text,
  raffle_status public.raffle_status,
  full_name text,
  document_type public.participant_document_type,
  document_number text,
  phone text,
  request_status public.purchase_request_status,
  purchased_at timestamptz,
  last_assigned_at timestamptz,
  ticket_count bigint,
  active_count bigint,
  frozen_count bigint,
  reassigned_count bigint,
  voided_count bigint,
  printed_ticket_count bigint,
  print_event_count bigint,
  total_count bigint
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_period text := lower(trim(coalesce(p_period, 'all')));
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_period not in ('all', 'current', 'past') then
    raise exception 'INVALID_TICKET_PERIOD' using errcode = '22023';
  end if;

  if p_date_from is not null and p_date_to is not null
     and p_date_from > p_date_to then
    raise exception 'INVALID_TICKET_DATE_RANGE' using errcode = '22023';
  end if;

  if p_ticket_number is not null
     and (p_ticket_number <= 0 or p_ticket_number > 1000000) then
    raise exception 'INVALID_TICKET_NUMBER' using errcode = '22023';
  end if;

  return query
  with eligible_groups as (
    select distinct
      t.purchase_request_id,
      t.raffle_id
    from public.tickets t
    join public.raffles r on r.id = t.raffle_id
    join public.purchase_requests pr on pr.id = t.purchase_request_id
    where (p_raffle_id is null or t.raffle_id = p_raffle_id)
      and (
        v_period = 'all'
        or (v_period = 'current' and r.status = 'active')
        or (v_period = 'past' and r.status in ('closed', 'cancelled'))
      )
      and (p_ticket_status is null or t.ticket_status = p_ticket_status)
      and (
        p_date_from is null
        or (pr.created_at at time zone 'America/Lima')::date >= p_date_from
      )
      and (
        p_date_to is null
        or (pr.created_at at time zone 'America/Lima')::date <= p_date_to
      )
      /*
       * El panel envía p_search Y p_ticket_number a la vez cuando el admin
       * teclea un número suelto. Deben unirse con OR: exigir ambos deja sin
       * resultados toda búsqueda numérica.
       */
      and (
        (v_search is null and p_ticket_number is null)
        or (
          v_search is not null
          and (
            pr.full_name ilike '%' || v_search || '%'
            or pr.dni ilike '%' || v_search || '%'
            or pr.phone ilike '%' || v_search || '%'
          )
        )
        or (
          p_ticket_number is not null
          and t.ticket_number = p_ticket_number
        )
      )
  ),
  print_counts as (
    select
      tp.ticket_id,
      count(*)::bigint as print_count
    from public.ticket_prints tp
    join public.tickets printed_ticket on printed_ticket.id = tp.ticket_id
    join eligible_groups eg
      on eg.purchase_request_id = printed_ticket.purchase_request_id
     and eg.raffle_id = printed_ticket.raffle_id
    group by tp.ticket_id
  ),
  grouped as (
    select
      eg.purchase_request_id,
      eg.raffle_id,
      r.name as raffle_name,
      r.status as raffle_status,
      pr.full_name,
      pr.document_type,
      pr.dni::text as document_number,
      pr.phone,
      pr.status as request_status,
      pr.created_at as purchased_at,
      max(t.assigned_at) as last_assigned_at,
      count(*)::bigint as ticket_count,
      count(*) filter (where t.ticket_status = 'active')::bigint as active_count,
      count(*) filter (where t.ticket_status = 'frozen')::bigint as frozen_count,
      count(*) filter (where t.ticket_status = 'reassigned')::bigint as reassigned_count,
      count(*) filter (where t.ticket_status = 'voided')::bigint as voided_count,
      count(*) filter (where coalesce(pc.print_count, 0) > 0)::bigint
        as printed_ticket_count,
      coalesce(sum(pc.print_count), 0)::bigint as print_event_count
    from eligible_groups eg
    join public.tickets t
      on t.purchase_request_id = eg.purchase_request_id
     and t.raffle_id = eg.raffle_id
    join public.raffles r on r.id = eg.raffle_id
    join public.purchase_requests pr on pr.id = eg.purchase_request_id
    left join print_counts pc on pc.ticket_id = t.id
    group by
      eg.purchase_request_id,
      eg.raffle_id,
      r.name,
      r.status,
      pr.full_name,
      pr.document_type,
      pr.dni,
      pr.phone,
      pr.status,
      pr.created_at
  )
  select
    g.purchase_request_id,
    g.raffle_id,
    g.raffle_name,
    g.raffle_status,
    g.full_name,
    g.document_type,
    g.document_number,
    g.phone,
    g.request_status,
    g.purchased_at,
    g.last_assigned_at,
    g.ticket_count,
    g.active_count,
    g.frozen_count,
    g.reassigned_count,
    g.voided_count,
    g.printed_ticket_count,
    g.print_event_count,
    count(*) over()::bigint as total_count
  from grouped g
  order by
    g.last_assigned_at desc,
    g.purchase_request_id desc,
    g.raffle_id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all
  on function public.admin_list_ticket_groups(
    uuid, text, public.ticket_lifecycle_status, date, date, text, integer, integer, integer
  )
  from public, anon, authenticated;

grant execute
  on function public.admin_list_ticket_groups(
    uuid, text, public.ticket_lifecycle_status, date, date, text, integer, integer, integer
  )
  to service_role;

comment on function public.admin_list_ticket_groups(
  uuid, text, public.ticket_lifecycle_status, date, date, text, integer, integer, integer
)
  is 'Lista grupos de tickets por solicitud y rifa. p_search y p_ticket_number se combinan con OR. Incluye voided_count. Uso exclusivo del backend.';


-- ------------------------------------------------------------
-- 2) La anulación se valida contra la rifa donde viven los tickets.
-- ------------------------------------------------------------
create or replace function public.void_purchase_request_tickets(
  p_admin_user_id uuid,
  p_purchase_request_id uuid,
  p_reason text
)
returns table (
  ticket_id uuid,
  ticket_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.purchase_requests%rowtype;
  v_active_count integer;
  v_inactive_raffle_count integer;
  v_reason text := nullif(
    regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'),
    ''
  );
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_purchase_request_id is null then
    raise exception 'INVALID_PURCHASE_REQUEST' using errcode = '22023';
  end if;

  if v_reason is null or char_length(v_reason) < 5 then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  if char_length(v_reason) > 500 then
    raise exception 'VOID_REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  select pr.*
  into v_request
  from public.purchase_requests pr
  where pr.id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'PURCHASE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status <> 'approved' then
    raise exception 'PURCHASE_REQUEST_NOT_APPROVED' using errcode = 'P0001';
  end if;

  /*
   * Tras una reasignación, purchase_requests.raffle_id apunta a la rifa
   * ORIGINAL (cancelada) mientras los tickets vigentes viven en la rifa
   * nueva. Se bloquean y validan las rifas de los tickets que se van a
   * anular, no la de la solicitud.
   */
  perform r.id
  from public.raffles r
  where r.id in (
    select distinct t.raffle_id
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.ticket_status = 'active'
  )
  order by r.id
  for update;

  select count(*)::integer
  into v_active_count
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id
    and t.ticket_status = 'active';

  if v_active_count = 0 then
    raise exception 'NO_ACTIVE_TICKETS' using errcode = 'P0001';
  end if;

  /* Solo antes del sorteo: una rifa activa nunca tiene ganador todavía. */
  select count(*)::integer
  into v_inactive_raffle_count
  from public.tickets t
  join public.raffles r on r.id = t.raffle_id
  where t.purchase_request_id = p_purchase_request_id
    and t.ticket_status = 'active'
    and r.status <> 'active';

  if v_inactive_raffle_count > 0 then
    raise exception 'RAFFLE_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  return query
  update public.tickets t
  set
    ticket_status = 'voided',
    voided_at = now(),
    voided_by = p_admin_user_id,
    void_reason = v_reason
  where t.purchase_request_id = p_purchase_request_id
    and t.ticket_status = 'active'
  returning t.id, t.ticket_number;
end;
$$;

revoke all
  on function public.void_purchase_request_tickets(uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.void_purchase_request_tickets(uuid, uuid, text)
  to service_role;

comment on function public.void_purchase_request_tickets(uuid, uuid, text)
  is 'Anula todos los tickets vigentes de una solicitud aprobada (devolución de compra antes del sorteo). Valida la rifa donde vive cada ticket, no la de la solicitud. Uso exclusivo del backend.';
