-- ============================================================
-- Corrección de aprobación y gestión de estados de solicitudes
-- ============================================================

create or replace function public.approve_purchase_request(
  p_purchase_request_id uuid,
  p_admin_user_id uuid
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
  v_next_ticket_number integer;
  v_last_ticket_number integer;
  v_generated_count integer;
begin
  if p_admin_user_id is null then
    raise exception 'El administrador es obligatorio.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = p_admin_user_id
      and ap.is_active = true
  ) then
    raise exception 'El usuario no es un administrador activo.'
      using errcode = '42501';
  end if;

  select pr.*
  into v_request
  from public.purchase_requests pr
  where pr.id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'La solicitud de compra no existe.'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception
      'La solicitud no está pendiente. Estado actual: %.',
      v_request.status
      using errcode = 'P0001';
  end if;

  /*
   * No se intenta actualizar aquí porque una excepción revertiría
   * el cambio. La expiración se gestiona con una función separada.
   */
  if v_request.expires_at <= now() then
    raise exception 'La reserva de la solicitud ha vencido.'
      using errcode = 'P0001';
  end if;

  select r.*
  into v_raffle
  from public.raffles r
  where r.id = v_request.raffle_id
  for update;

  if not found then
    raise exception 'La rifa asociada no existe.'
      using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'active' then
    raise exception 'La rifa no está activa.'
      using errcode = 'P0001';
  end if;

  select coalesce(max(t.ticket_number), 0) + 1
  into v_next_ticket_number
  from public.tickets t
  where t.raffle_id = v_raffle.id;

  v_last_ticket_number :=
    v_next_ticket_number + v_request.requested_quantity - 1;

  if v_last_ticket_number > v_raffle.total_tickets then
    raise exception
      'No existen suficientes boletos disponibles. Solicitados: %, disponibles: %.',
      v_request.requested_quantity,
      greatest(v_raffle.total_tickets - v_next_ticket_number + 1, 0)
      using errcode = 'P0001';
  end if;

  return query
  insert into public.tickets (
    raffle_id,
    purchase_request_id,
    ticket_number
  )
  select
    v_raffle.id,
    v_request.id,
    generated.ticket_number
  from generate_series(
    v_next_ticket_number,
    v_last_ticket_number
  ) as generated(ticket_number)
  returning
    public.tickets.id,
    public.tickets.ticket_number;

  get diagnostics v_generated_count = row_count;

  if v_generated_count <> v_request.requested_quantity then
    raise exception
      'La cantidad de boletos generados no coincide con la solicitud.'
      using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set
    status = 'approved',
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    rejection_reason = null
  where id = v_request.id;

  return;
end;
$$;

revoke execute
on function public.approve_purchase_request(uuid, uuid)
from public, anon, authenticated;

-- ============================================================
-- Rechazo administrativo
-- ============================================================

create or replace function public.reject_purchase_request(
  p_purchase_request_id uuid,
  p_admin_user_id uuid,
  p_rejection_reason text
)
returns public.purchase_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.purchase_requests%rowtype;
begin
  if p_admin_user_id is null then
    raise exception 'El administrador es obligatorio.'
      using errcode = '22023';
  end if;

  if p_rejection_reason is null
     or length(trim(p_rejection_reason)) = 0 then
    raise exception 'El motivo de rechazo es obligatorio.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = p_admin_user_id
      and ap.is_active = true
  ) then
    raise exception 'El usuario no es un administrador activo.'
      using errcode = '42501';
  end if;

  select pr.*
  into v_request
  from public.purchase_requests pr
  where pr.id = p_purchase_request_id
  for update;

  if not found then
    raise exception 'La solicitud de compra no existe.'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception
      'Solo se pueden rechazar solicitudes pendientes.'
      using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set
    status = 'rejected',
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    rejection_reason = trim(p_rejection_reason)
  where id = v_request.id
  returning *
  into v_request;

  return v_request;
end;
$$;

revoke execute
on function public.reject_purchase_request(uuid, uuid, text)
from public, anon, authenticated;

-- ============================================================
-- Expiración de reservas
-- ============================================================

create or replace function public.expire_purchase_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.purchase_requests
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  get diagnostics v_expired_count = row_count;

  return v_expired_count;
end;
$$;

revoke execute
on function public.expire_purchase_requests()
from public, anon, authenticated;

comment on function public.reject_purchase_request(uuid, uuid, text)
is 'Rechaza transaccionalmente una solicitud pendiente. Uso exclusivo del backend administrativo.';

comment on function public.expire_purchase_requests()
is 'Marca como vencidas las solicitudes pendientes cuya reserva haya expirado. Uso exclusivo del backend.';