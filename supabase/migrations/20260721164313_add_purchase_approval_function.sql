-- ============================================================
-- Aprobación atómica de solicitudes y generación de boletos
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
  -- La función solo puede ejecutarse con un administrador explícito.
  if p_admin_user_id is null then
    raise exception 'El administrador es obligatorio.'
      using errcode = '22023';
  end if;

  -- Confirma que el usuario existe como administrador activo.
  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = p_admin_user_id
      and ap.is_active = true
  ) then
    raise exception 'El usuario no es un administrador activo.'
      using errcode = '42501';
  end if;

  -- Bloquea la solicitud para impedir dos aprobaciones simultáneas.
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

  if v_request.expires_at <= now() then
    update public.purchase_requests
    set
      status = 'expired',
      updated_at = now()
    where id = v_request.id;

    raise exception 'La reserva de la solicitud ha vencido.'
      using errcode = 'P0001';
  end if;

  -- Bloquea la rifa para serializar la asignación de números.
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

  -- Calcula el siguiente número disponible.
  select coalesce(max(t.ticket_number), 0) + 1
  into v_next_ticket_number
  from public.tickets t
  where t.raffle_id = v_raffle.id;

  v_last_ticket_number :=
    v_next_ticket_number + v_request.requested_quantity - 1;

  if v_last_ticket_number > v_raffle.total_tickets then
    raise exception
      'No existen suficientes boletos disponibles. Solicitados: %, último disponible: %.',
      v_request.requested_quantity,
      greatest(v_raffle.total_tickets - v_next_ticket_number + 1, 0)
      using errcode = 'P0001';
  end if;

  -- Inserta todos los boletos dentro de la misma transacción.
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
    rejection_reason = null,
    updated_at = now()
  where id = v_request.id;

  return;
end;
$$;

-- La función es privilegiada y no debe quedar accesible por defecto.
revoke all
on function public.approve_purchase_request(uuid, uuid)
from public;

revoke all
on function public.approve_purchase_request(uuid, uuid)
from anon, authenticated;

comment on function public.approve_purchase_request(uuid, uuid)
is 'Aprueba una solicitud pendiente y genera sus boletos de forma atómica. Uso exclusivo del backend administrativo.';