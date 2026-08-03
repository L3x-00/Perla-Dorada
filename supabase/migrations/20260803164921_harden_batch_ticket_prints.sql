-- Cada tanda queda identificada en los registros de impresión. Esto permite
-- reconstruir exactamente el documento que originó una operación, sin tomar
-- por accidente una reimpresión posterior del mismo ticket.
alter table public.ticket_prints
  add column print_batch_id uuid;

create unique index ticket_prints_batch_ticket_idx
  on public.ticket_prints (print_batch_id, ticket_id)
  where print_batch_id is not null;

comment on column public.ticket_prints.print_batch_id
  is 'Identificador compartido por todas las impresiones registradas en una misma tanda administrativa.';

-- Cambia el tipo de retorno para incluir batch_id. El DROP y CREATE se
-- ejecutan dentro de la transacción de la migración.
drop function if exists public.register_purchase_request_ticket_prints(uuid, uuid, text);

create function public.register_purchase_request_ticket_prints(
  p_purchase_request_id uuid,
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
  v_active_ticket_count integer;
  v_processed_ticket_count integer := 0;
  v_batch_id uuid := extensions.gen_random_uuid();
  v_ticket public.tickets%rowtype;
  v_print public.ticket_prints%rowtype;
  v_existing_prints integer;
  v_print_type public.ticket_print_type;
  v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform public.assert_active_admin(p_admin_user_id);

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
  ) then
    raise exception 'PURCHASE_REQUEST_HAS_NO_TICKETS' using errcode = 'P0001';
  end if;

  -- Bloquear todo el historial de la solicitud impide que una reasignación
  -- cambie el conjunto activo mientras se registra la tanda. El orden estable
  -- evita interbloqueos entre operaciones concurrentes.
  perform t.id
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id
  order by t.id
  for update;

  -- Una reasignación concurrente puede haber insertado el sucesor mientras
  -- el bloqueo anterior esperaba al ticket de origen. Esta segunda lectura
  -- toma el snapshot actualizado y bloquea también toda la generación activa.
  perform t.id
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id
    and t.ticket_status = 'active'
  order by t.id
  for update;

  select count(*)::integer
  into v_active_ticket_count
  from public.tickets t
  where t.purchase_request_id = p_purchase_request_id
    and t.ticket_status = 'active';

  -- Los tickets frozen/reassigned son historial válido. Solo se imprime la
  -- generación activa, pero nunca una tanda parcial durante una reasignación.
  if v_active_ticket_count <> v_requested_quantity then
    raise exception 'ACTIVE_TICKET_COUNT_MISMATCH' using errcode = 'P0001';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'REPRINT_REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  for v_ticket in
    select t.*
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.ticket_status = 'active'
    order by t.ticket_number, t.id
  loop
    v_processed_ticket_count := v_processed_ticket_count + 1;

    select count(*)::integer into v_existing_prints
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
    ) returning * into v_print;

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
    raise exception 'ACTIVE_TICKET_COUNT_MISMATCH' using errcode = 'P0001';
  end if;
end;
$$;

revoke all
  on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  to service_role;

comment on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  is 'Registra atómicamente una tanda identificable de todos los tickets activos de una solicitud aprobada. Tolera el historial reassigned y rechaza tandas parciales. Uso solo del backend.';

-- Compatibilidad temporal de despliegue/rollback con la versión anterior del
-- backend. La UI nueva no usa esta RPC, pero mantenerla evita romper instancias
-- antiguas mientras el código y la base se publican por separado.
create or replace function public.register_purchase_request_ticket_print(
  p_purchase_request_id uuid,
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
  v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform public.assert_active_admin(p_admin_user_id);

  select pr.status into v_purchase_request_status
  from public.purchase_requests pr
  where pr.id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'PURCHASE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_purchase_request_status <> 'approved' then
    raise exception 'PURCHASE_REQUEST_NOT_APPROVED' using errcode = 'P0001';
  end if;

  select t.* into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_ticket.purchase_request_id <> p_purchase_request_id then
    raise exception 'TICKET_DOES_NOT_BELONG_TO_PURCHASE_REQUEST' using errcode = 'P0001';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_existing_prints
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
  ) returning * into v_print;

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
  on function public.register_purchase_request_ticket_print(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_purchase_request_ticket_print(uuid, uuid, uuid, text)
  to service_role;

comment on function public.register_purchase_request_ticket_print(uuid, uuid, uuid, text)
  is 'Compatibilidad temporal para instancias anteriores: registra una impresión ilimitada de un ticket activo de una solicitud aprobada. Uso solo del backend.';
