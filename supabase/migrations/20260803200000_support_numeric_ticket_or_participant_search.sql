-- Una consulta numérica puede ser simultáneamente un número de ticket,
-- documento o teléfono. La búsqueda administrativa devuelve la unión de
-- coincidencias sin obligar al operador a adivinar el tipo del dato.
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

comment on function public.admin_list_ticket_groups(
  uuid,
  text,
  public.ticket_lifecycle_status,
  date,
  date,
  text,
  integer,
  integer,
  integer
)
  is 'Lista grupos de tickets con filtros y paginacion. Las búsquedas numéricas unen coincidencias por participante y número de ticket. Uso exclusivo del backend.';
