-- ============================================================
-- Código de seguimiento corto y legible
--
-- Antes: 16 caracteres hexadecimales (encode(gen_random_bytes(8),'hex')).
-- Imposible de dictar por teléfono y de copiar sin error.
--
-- Ahora: 8 caracteres del alfabeto Crockford Base32
-- (0123456789ABCDEFGHJKMNPQRSTVWXYZ, sin I, L, O ni U). Da 32^8 ≈ 1.1e12
-- combinaciones, que con el rate limit de /api/tracking y /api/tickets
-- (20 por 15 min, 100 al día) hace inviable la enumeración.
--
-- Los códigos de 16 hex ya emitidos siguen siendo válidos: el CHECK de la
-- tabla exige longitud >= 8 y la normalización no altera cadenas hex.
--
-- Esta migración también rehace create_purchase_request para:
--   1. aceptar el tipo de documento (DNI o CUI),
--   2. permitir varias solicitudes pendientes por documento,
--   3. usar el código corto.
-- ============================================================

create or replace function public.generate_tracking_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Crockford Base32: 32 símbolos, sin los que se confunden al leer.
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_length constant integer := 8;
  v_max_attempts constant integer := 12;

  v_bytes bytea;
  v_code text;
  v_attempt integer := 0;
  v_index integer;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    v_bytes := extensions.gen_random_bytes(v_length);

    for v_index in 0 .. v_length - 1 loop
      /*
       * 256 es múltiplo exacto de 32, así que el módulo no introduce
       * sesgo: cada símbolo del alfabeto es equiprobable.
       */
      v_code := v_code || substr(
        v_alphabet,
        (get_byte(v_bytes, v_index) % 32) + 1,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.purchase_requests pr
      where pr.tracking_code = v_code
    ) then
      return v_code;
    end if;

    if v_attempt >= v_max_attempts then
      raise exception 'TRACKING_CODE_GENERATION_FAILED'
        using errcode = '55000';
    end if;
  end loop;
end;
$$;

comment on function public.generate_tracking_code()
  is 'Genera un código de seguimiento único de 8 caracteres Crockford Base32, reintentando ante colisión.';

revoke all on function public.generate_tracking_code()
  from public, anon, authenticated;

grant execute on function public.generate_tracking_code()
  to service_role;


-- ============================================================
-- create_purchase_request (firma nueva: incluye p_document_type)
-- ============================================================

drop function if exists public.create_purchase_request(
  uuid, text, text, text, text, integer, text
);

create or replace function public.create_purchase_request(
  p_request_id uuid,
  p_full_name text,
  p_document_type text,
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
  /*
   * Tope de solicitudes pendientes por documento y rifa.
   *
   * Ya no existe el límite de UNA pendiente por DNI: el cliente puede
   * comprar en varias tandas. Este tope solo evita que una sola persona
   * bloquee el inventario acumulando reservas sin pagar.
   */
  c_max_pending_per_document constant integer := 10;

  v_document_type public.participant_document_type;
  v_document_number text;
  v_raffle public.raffles%rowtype;
  v_tracking_code text;
  v_sold_count integer;
  v_reserved_count integer;
  v_available_count integer;
  v_pending_count integer;
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

  if coalesce(lower(trim(p_document_type)), '') not in ('dni', 'cui') then
    raise exception 'El tipo de documento no es válido.'
      using errcode = '22023';
  end if;

  v_document_type :=
    lower(trim(p_document_type))::public.participant_document_type;

  v_document_number := public.normalize_document_number(p_dni);

  if v_document_type = 'dni' then
    if v_document_number !~ '^[0-9]{8}$' then
      raise exception 'El DNI debe contener exactamente 8 dígitos.'
        using errcode = '22023';
    end if;
  else
    if v_document_number !~ '^[A-Z0-9]{6,20}$' then
      raise exception 'El CUI no es válido.'
        using errcode = '22023';
    end if;
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
  -- Tope de solicitudes pendientes por documento
  -- ==========================================================

  select count(*)
  into v_pending_count
  from public.purchase_requests pr
  where pr.raffle_id = v_raffle.id
    and pr.dni = v_document_number
    and pr.status = 'pending'
    and pr.expires_at > now();

  if v_pending_count >= c_max_pending_per_document then
    raise exception
      'Ya tienes % solicitudes pendientes de revisión.', v_pending_count
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

  v_tracking_code := public.generate_tracking_code();

  insert into public.purchase_requests (
    id,
    raffle_id,
    tracking_code,
    full_name,
    document_type,
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
    v_document_type,
    v_document_number,
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
  uuid, text, text, text, text, text, integer, text
)
from public, anon, authenticated;

grant execute
on function public.create_purchase_request(
  uuid, text, text, text, text, text, integer, text
)
to service_role;


-- ============================================================
-- Consultas públicas: comparar con normalización
--
-- El usuario escribe el documento con o sin guiones y el código con
-- confusiones típicas (O por 0, I por 1). Ambos lados se normalizan
-- antes de comparar. tracking_code está indexado como único, así que la
-- comparación normalizada del documento se evalúa sobre una sola fila.
-- ============================================================

create or replace function public.track_purchase_request(
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_name text,
  request_status public.purchase_request_status,
  expires_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  ticket_numbers integer[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pr.id as request_id,
    r.name as raffle_name,
    pr.status as request_status,
    pr.expires_at,
    pr.reviewed_at,

    case
      when pr.status = 'rejected'
        then pr.rejection_reason
      else null
    end as rejection_reason,

    coalesce(
      array_agg(
        t.ticket_number
        order by t.ticket_number
      ) filter (
        where
          t.id is not null
          and pr.status = 'approved'
      ),
      array[]::integer[]
    ) as ticket_numbers

  from public.purchase_requests pr

  inner join public.raffles r
    on r.id = pr.raffle_id

  left join public.tickets t
    on t.purchase_request_id = pr.id

  where pr.tracking_code =
        public.normalize_tracking_code(p_tracking_code)
    and public.normalize_document_number(pr.dni) =
        public.normalize_document_number(p_dni)

  group by
    pr.id,
    r.name,
    pr.status,
    pr.expires_at,
    pr.reviewed_at,
    pr.rejection_reason;
$$;

revoke all
  on function public.track_purchase_request(text, text)
  from public, anon, authenticated;

grant execute
  on function public.track_purchase_request(text, text)
  to service_role;


create or replace function public.get_public_ticket_document(
  p_dni text,
  p_tracking_code text
)
returns table (
  raffle_name text,
  raffle_description text,
  draw_at timestamptz,
  ticket_price numeric,
  full_name text,
  dni text,
  tracking_code text,
  ticket_numbers integer[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.name,
    r.description,
    r.draw_at,
    r.ticket_price,
    pr.full_name,
    pr.dni,
    pr.tracking_code,
    coalesce(
      array_agg(t.ticket_number order by t.ticket_number)
        filter (where t.ticket_number is not null),
      '{}'
    ) as ticket_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where pr.tracking_code =
        public.normalize_tracking_code(p_tracking_code)
    and public.normalize_document_number(pr.dni) =
        public.normalize_document_number(p_dni)
    and pr.status = 'approved'
  group by
    r.name,
    r.description,
    r.draw_at,
    r.ticket_price,
    pr.full_name,
    pr.dni,
    pr.tracking_code;
$$;

revoke all
  on function public.get_public_ticket_document(text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text)
  to service_role;
