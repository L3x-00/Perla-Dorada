-- ============================================================
-- Anular participación de una solicitud aprobada (devolución de compra
-- antes del sorteo, según bases legales aprobadas). Todos los tickets
-- activos de la solicitud pasan a 'voided': dejan de ser imprimibles y de
-- poder ganar, igual que los congelados, pero sin cancelar toda la rifa.
--
-- Por solicitud completa (no por ticket suelto). requested_quantity NO se
-- toca: conserva el histórico de lo originalmente comprado. Los
-- consumidores que validaban "activos == requested_quantity" pasan a
-- validar "activos + anulados == requested_quantity".
-- ============================================================

alter table public.tickets
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

alter table public.tickets
  drop constraint if exists tickets_voided_requires_timestamp,
  add constraint tickets_voided_requires_timestamp
  check (ticket_status <> 'voided' or voided_at is not null) not valid;

create index if not exists tickets_purchase_request_status_idx
  on public.tickets (purchase_request_id, ticket_status);


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
  v_raffle public.raffles%rowtype;
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

  select r.*
  into v_raffle
  from public.raffles r
  where r.id = v_request.raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  /*
   * Solo antes del sorteo: una rifa activa nunca tiene ganador todavía
   * (register_raffle_winner exige status = 'closed'), así que esta
   * condición ya garantiza que no se anule una participación premiada.
   */
  if v_raffle.status <> 'active' then
    raise exception 'RAFFLE_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.ticket_status = 'active'
  ) then
    raise exception 'NO_ACTIVE_TICKETS' using errcode = 'P0001';
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
  is 'Anula todos los tickets activos de una solicitud aprobada (devolución de compra antes del sorteo). No cancela la rifa ni las demás solicitudes. Uso exclusivo del backend.';


-- ------------------------------------------------------------
-- register_ticket_group_prints ahora acepta imprimir el resto de una
-- solicitud que tiene algunos tickets anulados: "completa" pasa a
-- significar activos + anulados == requested_quantity, en vez de exigir
-- que todos sigan activos.
-- ------------------------------------------------------------
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
  v_group_voided_count integer;
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
      where t.raffle_id = p_raffle_id and t.ticket_status = 'voided'
    )::integer,
    count(*) filter (
      where t.raffle_id <> p_raffle_id and t.ticket_status = 'active'
    )::integer
  into v_group_active_count, v_group_voided_count, v_other_active_count
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id;

  if (v_group_active_count + v_group_voided_count) <> v_requested_quantity
     or v_other_active_count <> 0 then
    raise exception 'TICKET_GROUP_NOT_PRINTABLE' using errcode = 'P0001';
  end if;

  if v_group_active_count = 0 then
    raise exception 'TICKET_GROUP_FULLY_VOIDED' using errcode = 'P0001';
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

  if v_processed_ticket_count <> v_group_active_count then
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
  is 'Registra una tanda ilimitada y auditable de todos los tickets activos de una solicitud y una rifa. Admite solicitudes con tickets anulados: solo imprime los que siguen activos.';
