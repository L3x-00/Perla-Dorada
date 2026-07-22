-- ============================================================
-- ERR-08 (cont.): create_purchase_request fallaba con
-- "function gen_random_bytes(integer) does not exist".
--
-- Causa (heredada del original): con `search_path = ''` la llamada
-- sin calificar a gen_random_bytes (pgcrypto, instalado en el esquema
-- `extensions`) no se resuelve. El resto de funciones usadas son de
-- pg_catalog y sí resuelven con search_path vacío.
--
-- Fix: calificar como extensions.gen_random_bytes(...). Se conservan los
-- fixes previos (reservation_minutes configurable y alias en el UPDATE).
-- ============================================================

create or replace function public.create_purchase_request(
  p_request_id uuid,
  p_full_name text,
  p_dni text,
  p_phone text,
  p_whatsapp text,
  p_requested_quantity integer,
  p_payment_proof_path text
)
returns table (
  request_id uuid,
  raffle_id uuid,
  tracking_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_tracking_code text;
  v_sold_count integer;
  v_reserved_count integer;
  v_available_count integer;
  v_reservation_minutes integer;
  v_expires_at timestamptz;
begin
  -- ==========================================================
  -- Validaciones básicas
  -- ==========================================================

  if p_request_id is null then
    raise exception 'El identificador de solicitud es obligatorio.'
      using errcode = '22023';
  end if;

  if length(trim(p_full_name)) < 3 then
    raise exception 'El nombre completo no es válido.'
      using errcode = '22023';
  end if;

  if p_dni !~ '^[0-9]{8}$' then
    raise exception 'El DNI debe contener exactamente 8 dígitos.'
      using errcode = '22023';
  end if;

  if p_phone !~ '^[0-9]{7,15}$' then
    raise exception 'El teléfono no es válido.'
      using errcode = '22023';
  end if;

  if p_whatsapp !~ '^[0-9]{7,15}$' then
    raise exception 'El número de WhatsApp no es válido.'
      using errcode = '22023';
  end if;

  if p_requested_quantity <= 0 then
    raise exception 'La cantidad solicitada debe ser mayor que cero.'
      using errcode = '22023';
  end if;

  if nullif(trim(p_payment_proof_path), '') is null then
    raise exception 'La ruta del comprobante es obligatoria.'
      using errcode = '22023';
  end if;

  -- ==========================================================
  -- Minutos de reserva configurables (app_settings)
  -- ==========================================================

  select a.reservation_minutes
  into v_reservation_minutes
  from public.app_settings a
  where a.id = true;

  if v_reservation_minutes is null or v_reservation_minutes <= 0 then
    v_reservation_minutes := 60;
  end if;

  v_expires_at := now() + make_interval(mins => v_reservation_minutes);

  -- ==========================================================
  -- Bloqueo de la rifa activa
  -- ==========================================================

  select r.*
  into v_raffle
  from public.raffles r
  where r.status = 'active'
  order by r.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No existe una rifa activa.'
      using errcode = 'P0002';
  end if;

  -- ==========================================================
  -- Expiración de reservas anteriores
  -- (alias explícito para evitar ambigüedad con las columnas de salida)
  -- ==========================================================

  update public.purchase_requests as pr
  set status = 'expired'
  where pr.raffle_id = v_raffle.id
    and pr.status = 'pending'
    and pr.expires_at <= now();

  -- ==========================================================
  -- Una solicitud pendiente por DNI y rifa
  -- ==========================================================

  if exists (
    select 1
    from public.purchase_requests pr
    where pr.raffle_id = v_raffle.id
      and pr.dni = p_dni
      and pr.status = 'pending'
      and pr.expires_at > now()
  ) then
    raise exception
      'Ya existe una solicitud pendiente para este DNI.'
      using errcode = '23505';
  end if;

  -- ==========================================================
  -- Disponibilidad considerando vendidos y reservados
  -- ==========================================================

  select count(*)
  into v_sold_count
  from public.tickets t
  where t.raffle_id = v_raffle.id;

  select coalesce(sum(pr.requested_quantity), 0)::integer
  into v_reserved_count
  from public.purchase_requests pr
  where pr.raffle_id = v_raffle.id
    and pr.status = 'pending'
    and pr.expires_at > now();

  v_available_count :=
    v_raffle.total_tickets - v_sold_count - v_reserved_count;

  if p_requested_quantity > v_available_count then
    raise exception
      'No hay suficientes boletos disponibles. Disponibles: %.',
      greatest(v_available_count, 0)
      using errcode = 'P0001';
  end if;

  -- Código de seguimiento aleatorio de 16 caracteres hexadecimales.
  v_tracking_code :=
    upper(encode(extensions.gen_random_bytes(8), 'hex'));

  insert into public.purchase_requests (
    id,
    raffle_id,
    tracking_code,
    full_name,
    dni,
    phone,
    whatsapp,
    requested_quantity,
    payment_proof_path,
    status,
    expires_at
  )
  values (
    p_request_id,
    v_raffle.id,
    v_tracking_code,
    trim(p_full_name),
    p_dni,
    p_phone,
    p_whatsapp,
    p_requested_quantity,
    trim(p_payment_proof_path),
    'pending',
    v_expires_at
  );

  return query
  select
    p_request_id,
    v_raffle.id,
    v_tracking_code,
    v_expires_at;
end;
$$;

revoke all
on function public.create_purchase_request(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text
)
from public, anon, authenticated;

grant execute
on function public.create_purchase_request(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text
)
to service_role;
