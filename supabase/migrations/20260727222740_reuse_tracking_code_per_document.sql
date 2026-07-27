-- One canonical tracking code per participant document. Existing codes remain
-- usable as aliases, while all future purchase requests use the canonical one.
create table public.participant_tracking_codes (
  document_type public.participant_document_type not null,
  document_number text not null,
  tracking_code text not null,
  created_at timestamptz not null default now(),
  primary key (document_type, document_number),
  unique (tracking_code),
  check (length(trim(document_number)) > 0),
  check (tracking_code ~ '^[0-9A-HJKMNPQRSTVWXYZ]{8,16}$')
);

create table public.participant_tracking_code_aliases (
  tracking_code text primary key,
  document_type public.participant_document_type not null,
  document_number text not null,
  created_at timestamptz not null default now(),
  check (length(trim(document_number)) > 0),
  check (tracking_code ~ '^[0-9A-HJKMNPQRSTVWXYZ]{8,16}$')
);

insert into public.participant_tracking_codes (
  document_type, document_number, tracking_code, created_at
)
select distinct on (pr.document_type, public.normalize_document_number(pr.dni))
  pr.document_type, public.normalize_document_number(pr.dni),
  pr.tracking_code, pr.created_at
from public.purchase_requests pr
order by pr.document_type, public.normalize_document_number(pr.dni),
  pr.created_at asc, pr.id asc;

insert into public.participant_tracking_code_aliases (
  tracking_code, document_type, document_number
)
select pr.tracking_code, pr.document_type, public.normalize_document_number(pr.dni)
from public.purchase_requests pr
on conflict (tracking_code) do nothing;

drop index if exists public.purchase_requests_tracking_code_idx;

update public.purchase_requests pr
set tracking_code = ptc.tracking_code
from public.participant_tracking_codes ptc
where ptc.document_type = pr.document_type
  and ptc.document_number = public.normalize_document_number(pr.dni)
  and pr.tracking_code <> ptc.tracking_code;

create index purchase_requests_tracking_code_idx
  on public.purchase_requests (tracking_code);

alter table public.participant_tracking_codes enable row level security;
alter table public.participant_tracking_code_aliases enable row level security;

create or replace function public.generate_tracking_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
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
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_index) % 32) + 1, 1);
    end loop;
    if not exists (select 1 from public.participant_tracking_codes ptc where ptc.tracking_code = v_code)
      and not exists (select 1 from public.participant_tracking_code_aliases ptca where ptca.tracking_code = v_code) then
      return v_code;
    end if;
    if v_attempt >= v_max_attempts then
      raise exception 'TRACKING_CODE_GENERATION_FAILED' using errcode = '55000';
    end if;
  end loop;
end;
$$;

create or replace function public.create_purchase_request(
  p_request_id uuid, p_full_name text, p_document_type text, p_dni text,
  p_phone text, p_whatsapp text, p_requested_quantity integer,
  p_payment_proof_path text
)
returns table (request_id uuid, raffle_id uuid, tracking_code text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
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
  if p_request_id is null then raise exception 'El identificador de solicitud es obligatorio.' using errcode = '22023'; end if;
  if length(trim(p_full_name)) < 3 then raise exception 'El nombre completo no es valido.' using errcode = '22023'; end if;
  if coalesce(lower(trim(p_document_type)), '') not in ('dni', 'cui') then raise exception 'El tipo de documento no es valido.' using errcode = '22023'; end if;
  v_document_type := lower(trim(p_document_type))::public.participant_document_type;
  v_document_number := public.normalize_document_number(p_dni);
  if v_document_type = 'dni' and v_document_number !~ '^[0-9]{8}$' then raise exception 'El DNI debe contener exactamente 8 digitos.' using errcode = '22023'; end if;
  if v_document_type = 'cui' and v_document_number !~ '^[A-Z0-9]{6,20}$' then raise exception 'El CUI no es valido.' using errcode = '22023'; end if;
  if p_phone !~ '^[0-9]{7,15}$' then raise exception 'El telefono no es valido.' using errcode = '22023'; end if;
  if p_whatsapp !~ '^[0-9]{7,15}$' then raise exception 'El numero de WhatsApp no es valido.' using errcode = '22023'; end if;
  if p_requested_quantity <= 0 then raise exception 'La cantidad solicitada debe ser mayor que cero.' using errcode = '22023'; end if;
  if nullif(trim(p_payment_proof_path), '') is null then raise exception 'La ruta del comprobante es obligatoria.' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_document_type::text || ':' || v_document_number));
  select a.reservation_minutes into v_reservation_minutes from public.app_settings a where a.id = true;
  if v_reservation_minutes is null or v_reservation_minutes <= 0 then v_reservation_minutes := 60; end if;
  v_expires_at := now() + make_interval(mins => v_reservation_minutes);

  select r.* into v_raffle from public.raffles r where r.status = 'active' order by r.created_at desc limit 1 for update;
  if not found then raise exception 'No existe una rifa activa.' using errcode = 'P0002'; end if;
  update public.purchase_requests as pr set status = 'expired' where pr.raffle_id = v_raffle.id and pr.status = 'pending' and pr.expires_at <= now();
  select count(*) into v_pending_count from public.purchase_requests pr where pr.raffle_id = v_raffle.id and pr.document_type = v_document_type and public.normalize_document_number(pr.dni) = v_document_number and pr.status = 'pending' and pr.expires_at > now();
  if v_pending_count >= c_max_pending_per_document then raise exception 'Ya tienes % solicitudes pendientes de revision.', v_pending_count using errcode = '23505'; end if;
  select count(*) into v_sold_count from public.tickets t where t.raffle_id = v_raffle.id;
  select coalesce(sum(pr.requested_quantity), 0)::integer into v_reserved_count from public.purchase_requests pr where pr.raffle_id = v_raffle.id and pr.status = 'pending' and pr.expires_at > now();
  v_available_count := v_raffle.total_tickets - v_sold_count - v_reserved_count;
  if p_requested_quantity > v_available_count then raise exception 'No hay suficientes boletos disponibles. Disponibles: %.', greatest(v_available_count, 0) using errcode = 'P0001'; end if;

  select ptc.tracking_code into v_tracking_code from public.participant_tracking_codes ptc where ptc.document_type = v_document_type and ptc.document_number = v_document_number;
  if v_tracking_code is null then
    -- Serializes only first-time code allocation; document purchases still use
    -- their own advisory lock above.
    perform pg_catalog.pg_advisory_xact_lock(8675309);

    select ptc.tracking_code into v_tracking_code from public.participant_tracking_codes ptc where ptc.document_type = v_document_type and ptc.document_number = v_document_number;

    if v_tracking_code is null then
    v_tracking_code := public.generate_tracking_code();
    insert into public.participant_tracking_codes (document_type, document_number, tracking_code) values (v_document_type, v_document_number, v_tracking_code);
    end if;
  end if;
  insert into public.purchase_requests (id, raffle_id, tracking_code, full_name, document_type, dni, phone, whatsapp, requested_quantity, payment_proof_path, status, expires_at)
  values (p_request_id, v_raffle.id, v_tracking_code, trim(p_full_name), v_document_type, v_document_number, p_phone, p_whatsapp, p_requested_quantity, trim(p_payment_proof_path), 'pending', v_expires_at);
  return query select p_request_id, v_raffle.id, v_tracking_code, v_expires_at;
end;
$$;

create or replace function public.track_purchase_request(
  p_document_type text, p_dni text, p_tracking_code text
)
returns table (request_id uuid, raffle_name text, request_status public.purchase_request_status, requested_at timestamptz, expires_at timestamptz, reviewed_at timestamptz, rejection_reason text, ticket_numbers integer[])
language sql security definer set search_path = '' stable
as $$
  select pr.id, r.name, pr.status, pr.created_at, pr.expires_at, pr.reviewed_at,
    case when pr.status = 'rejected' then pr.rejection_reason else null end,
    coalesce(array_agg(t.ticket_number order by t.ticket_number) filter (where t.id is not null and t.raffle_id = pr.raffle_id and t.ticket_status = 'active'), array[]::integer[])
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where pr.document_type = lower(trim(p_document_type))::public.participant_document_type
    and public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and (
      exists (select 1 from public.participant_tracking_codes ptc where ptc.document_type = pr.document_type and ptc.document_number = public.normalize_document_number(pr.dni) and ptc.tracking_code = public.normalize_tracking_code(p_tracking_code))
      or exists (select 1 from public.participant_tracking_code_aliases ptca where ptca.document_type = pr.document_type and ptca.document_number = public.normalize_document_number(pr.dni) and ptca.tracking_code = public.normalize_tracking_code(p_tracking_code))
    )
  group by pr.id, r.name, pr.status, pr.created_at, pr.expires_at, pr.reviewed_at, pr.rejection_reason
  order by pr.created_at desc;
$$;

create or replace function public.get_public_ticket_document(
  p_document_type text, p_dni text, p_tracking_code text
)
returns table (request_id uuid, raffle_name text, full_name text, dni text, purchased_at timestamptz, ticket_status public.ticket_lifecycle_status, ticket_numbers integer[])
language sql security definer set search_path = '' stable
as $$
  select pr.id, r.name, pr.full_name, pr.dni, pr.created_at, t.ticket_status, array_agg(t.ticket_number order by t.ticket_number)
  from public.purchase_requests pr
  join public.tickets t on t.purchase_request_id = pr.id
  join public.raffles r on r.id = t.raffle_id
  where pr.document_type = lower(trim(p_document_type))::public.participant_document_type
    and public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and pr.status = 'approved'
    and (
      exists (select 1 from public.participant_tracking_codes ptc where ptc.document_type = pr.document_type and ptc.document_number = public.normalize_document_number(pr.dni) and ptc.tracking_code = public.normalize_tracking_code(p_tracking_code))
      or exists (select 1 from public.participant_tracking_code_aliases ptca where ptca.document_type = pr.document_type and ptca.document_number = public.normalize_document_number(pr.dni) and ptca.tracking_code = public.normalize_tracking_code(p_tracking_code))
    )
  group by pr.id, r.name, pr.full_name, pr.dni, pr.created_at, t.ticket_status
  order by pr.created_at desc, r.name;
$$;

revoke all on table public.participant_tracking_codes from public, anon, authenticated;
revoke all on table public.participant_tracking_code_aliases from public, anon, authenticated;
revoke all on function public.track_purchase_request(text, text, text) from public, anon, authenticated;
grant execute on function public.track_purchase_request(text, text, text) to service_role;
revoke all on function public.get_public_ticket_document(text, text, text) from public, anon, authenticated;
grant execute on function public.get_public_ticket_document(text, text, text) to service_role;
