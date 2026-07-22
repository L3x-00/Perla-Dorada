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
  v_reprints_used integer;
  v_max_reprints integer;
  v_print_type public.ticket_print_type;
  v_print_sequence integer;
  v_reason text;
begin
  /*
   * Verifica que el usuario indicado sea un administrador activo.
   * Aunque la función se invoque con service_role, conservamos esta
   * validación como regla de dominio y auditoría.
   */
  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = p_admin_user_id
      and ap.is_active = true
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_NOT_ACTIVE';
  end if;

  /*
   * Bloquea el ticket. Todas las impresiones del mismo ticket quedan
   * serializadas y no pueden calcular simultáneamente la misma secuencia.
   */
  select t.*
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'TICKET_NOT_FOUND';
  end if;

  select pr.status
  into v_purchase_request_status
  from public.purchase_requests pr
  where pr.id = v_ticket.purchase_request_id;

  if v_purchase_request_status is distinct from 'approved' then
    raise exception using
      errcode = 'P0001',
      message = 'PURCHASE_REQUEST_NOT_APPROVED';
  end if;

  select s.max_reprints
  into v_max_reprints
  from public.app_settings s
  where s.id = true;

  if v_max_reprints is null then
    raise exception using
      errcode = 'P0001',
      message = 'APP_SETTINGS_NOT_FOUND';
  end if;

  select count(*)::integer
  into v_existing_prints
  from public.ticket_prints tp
  where tp.ticket_id = p_ticket_id;

  v_reprints_used := greatest(v_existing_prints - 1, 0);

  if v_existing_prints = 0 then
    v_print_type := 'original';
    v_print_sequence := 1;
    v_reason := null;
  else
    if v_reprints_used >= v_max_reprints then
      raise exception using
        errcode = 'P0001',
        message = 'MAX_REPRINTS_REACHED';
    end if;

    v_reason := nullif(trim(p_reason), '');

    if v_reason is null then
      raise exception using
        errcode = 'P0001',
        message = 'REPRINT_REASON_REQUIRED';
    end if;

    if length(v_reason) > 500 then
      raise exception using
        errcode = 'P0001',
        message = 'REPRINT_REASON_TOO_LONG';
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
  )
  values (
    p_ticket_id,
    v_print_type,
    v_print_sequence,
    p_admin_user_id,
    v_reason
  )
  returning *
  into v_print;

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
    v_max_reprints;
end;
$$;

revoke all on function public.register_ticket_print(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.register_ticket_print(uuid, uuid, text)
to service_role;

comment on function public.register_ticket_print(uuid, uuid, text) is
'Registra atómicamente la impresión original o una reimpresión de un ticket, validando administrador, aprobación, motivo y límite de reimpresiones.';