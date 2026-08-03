-- La impresión desde la revisión de una solicitud aprobada no está sujeta al
-- límite operativo de reimpresiones. La RPC es separada para que el bypass no
-- sea controlable desde el navegador ni afecte la pantalla general de Tickets.
create function public.register_purchase_request_ticket_print(
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
  v_print_sequence integer;
  v_reason text;
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
    raise exception 'TICKET_DOES_NOT_BELONG_TO_PURCHASE_REQUEST'
      using errcode = 'P0001';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_existing_prints
  from public.ticket_prints tp
  where tp.ticket_id = p_ticket_id;

  if v_existing_prints = 0 then
    v_print_type := 'original';
    v_print_sequence := 1;
    v_reason := null;
  else
    v_reason := nullif(trim(p_reason), '');

    if v_reason is null then
      raise exception 'REPRINT_REASON_REQUIRED' using errcode = 'P0001';
    end if;

    if length(v_reason) > 500 then
      raise exception 'REPRINT_REASON_TOO_LONG' using errcode = 'P0001';
    end if;

    v_print_type := 'reprint';
    v_print_sequence := v_existing_prints + 1;
  end if;

  insert into public.ticket_prints (
    ticket_id,
    print_type,
    print_sequence,
    printed_by,
    reason
  ) values (
    p_ticket_id,
    v_print_type,
    v_print_sequence,
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
  is 'Registra impresiones ilimitadas exclusivamente para un ticket perteneciente a una solicitud aprobada. Uso solo del backend.';
