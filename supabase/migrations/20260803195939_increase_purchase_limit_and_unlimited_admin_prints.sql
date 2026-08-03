-- Compra de hasta 50 tickets e impresion administrativa sin limite.
--
-- Los identificadores internos (UUID y ticket_number) no cambian. El codigo
-- visual PD-#### se resuelve en la aplicacion y sigue siendo unico dentro de
-- cada rifa gracias a tickets_raffle_number_unique.

alter table public.purchase_requests
  drop constraint if exists purchase_requests_quantity_max_per_request;

alter table public.purchase_requests
  add constraint purchase_requests_quantity_max_per_request
  check (requested_quantity <= 50) not valid;

alter table public.purchase_requests
  validate constraint purchase_requests_quantity_max_per_request;

comment on constraint purchase_requests_quantity_max_per_request
  on public.purchase_requests
  is 'Maximo autoritativo de 50 tickets por solicitud.';

-- La impresion individual del panel pasa a ser ilimitada. Se conserva toda
-- la trazabilidad: administrador, instante, secuencia y motivo obligatorio a
-- partir de la segunda generacion del documento.
create or replace function public.register_ticket_print(
  p_ticket_id uuid,
  p_admin_user_id uuid,
  p_reason text default null
)
returns table (
  print_id uuid,
  ticket_id uuid,
  ticket_number integer,
  print_type public.ticket_print_type,
  print_sequence integer,
  printed_at timestamptz,
  reprints_used integer,
  max_reprints integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets%rowtype;
  v_print public.ticket_prints%rowtype;
  v_purchase_request_status public.purchase_request_status;
  v_existing_prints integer;
  v_print_type public.ticket_print_type;
  v_reason text := nullif(
    regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'),
    ''
  );
begin
  perform public.assert_active_admin(p_admin_user_id);

  select t.*
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select pr.status
  into v_purchase_request_status
  from public.purchase_requests pr
  where pr.id = v_ticket.purchase_request_id;

  if v_purchase_request_status is distinct from 'approved' then
    raise exception 'PURCHASE_REQUEST_NOT_APPROVED' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_existing_prints
  from public.ticket_prints tp
  where tp.ticket_id = p_ticket_id;

  if v_existing_prints = 0 then
    v_print_type := 'original';
    v_reason := null;
  else
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'REPRINT_REASON_REQUIRED' using errcode = 'P0001';
    end if;

    if char_length(v_reason) > 500 then
      raise exception 'REPRINT_REASON_TOO_LONG' using errcode = 'P0001';
    end if;

    v_print_type := 'reprint';
  end if;

  insert into public.ticket_prints (
    ticket_id,
    print_type,
    print_sequence,
    printed_by,
    reason
  ) values (
    v_ticket.id,
    v_print_type,
    v_existing_prints + 1,
    p_admin_user_id,
    v_reason
  )
  returning * into v_print;

  return query
  select
    v_print.id,
    v_ticket.id,
    v_ticket.ticket_number,
    v_print.print_type,
    v_print.print_sequence,
    v_print.printed_at,
    case
      when v_print.print_type = 'original' then 0
      else v_print.print_sequence - 1
    end,
    null::integer;
end;
$$;

revoke all
  on function public.register_ticket_print(uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_ticket_print(uuid, uuid, text)
  to service_role;

comment on function public.register_ticket_print(uuid, uuid, text)
  is 'Registra impresiones administrativas ilimitadas de un ticket activo. Toda reimpresion exige motivo y conserva actor, fecha y secuencia. Uso exclusivo del backend.';

comment on column public.app_settings.max_reprints
  is 'Campo heredado conservado temporalmente para compatibilidad de rollback; ya no limita la impresion administrativa.';

-- Consulta paginada por grupos solicitud + rifa. La preagregacion impide que
-- ticket_prints multiplique los tickets y mantiene exactos todos los conteos.
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

  if p_ticket_number is not null and p_ticket_number <= 0 then
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
        v_search is null
        or pr.full_name ilike '%' || v_search || '%'
        or pr.dni ilike '%' || v_search || '%'
        or pr.phone ilike '%' || v_search || '%'
      )
      and (p_ticket_number is null or t.ticket_number = p_ticket_number)
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

revoke all
  on function public.admin_list_ticket_groups(
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
  from public, anon, authenticated;

grant execute
  on function public.admin_list_ticket_groups(
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
  to service_role;

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
  is 'Lista grupos de tickets por solicitud y rifa con filtros, conteos y paginacion. Uso exclusivo del backend.';

-- La impresion conjunta iniciada desde /admin/tickets queda acotada de forma
-- autoritativa a una sola solicitud y una sola rifa.
create or replace function public.register_ticket_group_prints(
  p_purchase_request_id uuid,
  p_raffle_id uuid,
  p_admin_user_id uuid,
  p_reason text default null
)
returns table (
  batch_id uuid,
  print_id uuid,
  ticket_id uuid,
  ticket_number integer,
  print_type public.ticket_print_type,
  print_sequence integer,
  printed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_request_status public.purchase_request_status;
  v_requested_quantity integer;
  v_group_active_count integer;
  v_other_active_count integer;
  v_processed_ticket_count integer := 0;
  v_batch_id uuid := extensions.gen_random_uuid();
  v_ticket public.tickets%rowtype;
  v_print public.ticket_prints%rowtype;
  v_existing_prints integer;
  v_print_type public.ticket_print_type;
  v_reason text := nullif(
    regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'),
    ''
  );
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_purchase_request_id is null or p_raffle_id is null then
    raise exception 'INVALID_TICKET_GROUP' using errcode = '22023';
  end if;

  select pr.status, pr.requested_quantity
  into v_purchase_request_status, v_requested_quantity
  from public.purchase_requests pr
  where pr.id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'PURCHASE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_purchase_request_status <> 'approved' then
    raise exception 'PURCHASE_REQUEST_NOT_APPROVED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.raffle_id = p_raffle_id
  ) then
    raise exception 'TICKET_GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform t.id
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id
  order by t.id
  for update;

  select
    count(*) filter (
      where t.raffle_id = p_raffle_id and t.ticket_status = 'active'
    )::integer,
    count(*) filter (
      where t.raffle_id <> p_raffle_id and t.ticket_status = 'active'
    )::integer
  into v_group_active_count, v_other_active_count
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id;

  if v_group_active_count <> v_requested_quantity or v_other_active_count <> 0 then
    raise exception 'TICKET_GROUP_NOT_PRINTABLE' using errcode = 'P0001';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'REPRINT_REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  for v_ticket in
    select t.*
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.raffle_id = p_raffle_id
      and t.ticket_status = 'active'
    order by t.ticket_number, t.id
  loop
    v_processed_ticket_count := v_processed_ticket_count + 1;

    select count(*)::integer
    into v_existing_prints
    from public.ticket_prints tp
    where tp.ticket_id = v_ticket.id;

    if v_existing_prints = 0 then
      v_print_type := 'original';
    else
      if v_reason is null or char_length(v_reason) < 3 then
        raise exception 'REPRINT_REASON_REQUIRED' using errcode = 'P0001';
      end if;

      v_print_type := 'reprint';
    end if;

    insert into public.ticket_prints (
      ticket_id,
      print_type,
      print_sequence,
      printed_by,
      reason,
      print_batch_id
    ) values (
      v_ticket.id,
      v_print_type,
      v_existing_prints + 1,
      p_admin_user_id,
      case when v_print_type = 'reprint' then v_reason else null end,
      v_batch_id
    )
    returning * into v_print;

    return query
    select
      v_batch_id,
      v_print.id,
      v_ticket.id,
      v_ticket.ticket_number,
      v_print.print_type,
      v_print.print_sequence,
      v_print.printed_at;
  end loop;

  if v_processed_ticket_count <> v_requested_quantity then
    raise exception 'TICKET_GROUP_NOT_PRINTABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all
  on function public.register_ticket_group_prints(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_ticket_group_prints(uuid, uuid, uuid, text)
  to service_role;

comment on function public.register_ticket_group_prints(uuid, uuid, uuid, text)
  is 'Registra una tanda ilimitada y auditable, acotada a una solicitud y una rifa, de todos sus tickets activos.';

create index if not exists purchase_requests_created_at_id_idx
  on public.purchase_requests (created_at desc, id desc);

create index if not exists tickets_request_raffle_status_number_idx
  on public.tickets (
    purchase_request_id,
    raffle_id,
    ticket_status,
    ticket_number
  );
