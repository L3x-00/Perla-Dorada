-- Sustituye la impresión individual de Solicitudes por una operación atómica
-- que registra todos los tickets de una compra y produce un único documento
-- listo para imprimir en cortes consecutivos.
drop function if exists public.register_purchase_request_ticket_print(uuid, uuid, uuid, text);

create function public.register_purchase_request_ticket_prints(
  p_purchase_request_id uuid,
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
  v_purchase_request_status public.purchase_request_status;
  v_ticket public.tickets%rowtype;
  v_print public.ticket_prints%rowtype;
  v_existing_prints integer;
  v_print_type public.ticket_print_type;
  v_reason text;
  v_has_reprints boolean;
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

  if not exists (
    select 1
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
  ) then
    raise exception 'PURCHASE_REQUEST_HAS_NO_TICKETS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
      and t.ticket_status <> 'active'
  ) then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.ticket_prints tp
    join public.tickets t on t.id = tp.ticket_id
    where t.purchase_request_id = p_purchase_request_id
  ) into v_has_reprints;

  v_reason := nullif(trim(p_reason), '');

  if v_has_reprints and v_reason is null then
    raise exception 'REPRINT_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'REPRINT_REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  for v_ticket in
    select t.*
    from public.tickets t
    where t.purchase_request_id = p_purchase_request_id
    order by t.ticket_number
    for update
  loop
    select count(*)::integer into v_existing_prints
    from public.ticket_prints tp
    where tp.ticket_id = v_ticket.id;

    if v_existing_prints = 0 then
      v_print_type := 'original';
    else
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
      case when v_print_type = 'reprint' then v_reason else null end
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
  end loop;
end;
$$;

revoke all
  on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  to service_role;

comment on function public.register_purchase_request_ticket_prints(uuid, uuid, text)
  is 'Registra atómicamente todos los tickets activos de una solicitud aprobada para una impresión conjunta. Uso solo del backend.';
