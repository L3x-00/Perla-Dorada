-- ============================================================
-- Endurecimiento de compras, privacidad y ciclo de tickets
--
-- - Máximo autoritativo de 30 tickets por solicitud.
-- - Un ticket de una rifa cancelada queda congelado; nunca se mueve ni se
--   reutiliza. Una reasignación crea un NUEVO ticket trazable en la nueva
--   rifa y conserva el original como historial.
-- - La consulta pública vuelve a requerir documento + tracking code.
-- - delete_raffle se limita a borradores completamente vacíos.
-- ============================================================

alter table public.purchase_requests
  drop constraint if exists purchase_requests_quantity_max_per_request;

alter table public.purchase_requests
  add constraint purchase_requests_quantity_max_per_request
  check (requested_quantity <= 30) not valid;


do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ticket_lifecycle_status'
      and n.nspname = 'public'
  ) then
    create type public.ticket_lifecycle_status as enum (
      'active',
      'frozen',
      'reassigned'
    );
  end if;
end;
$$;

alter table public.tickets
  add column if not exists ticket_status public.ticket_lifecycle_status
    not null default 'active',
  add column if not exists frozen_at timestamptz,
  add column if not exists reassigned_at timestamptz,
  add column if not exists reassigned_by uuid
    references auth.users(id) on delete set null,
  add column if not exists origin_ticket_id uuid
    references public.tickets(id) on delete restrict;

alter table public.tickets
  drop constraint if exists tickets_frozen_requires_timestamp,
  add constraint tickets_frozen_requires_timestamp
  check (ticket_status <> 'frozen' or frozen_at is not null) not valid;

alter table public.tickets
  drop constraint if exists tickets_reassigned_requires_timestamp,
  add constraint tickets_reassigned_requires_timestamp
  check (ticket_status <> 'reassigned' or reassigned_at is not null) not valid;

create unique index if not exists tickets_one_successor_per_origin_idx
  on public.tickets (origin_ticket_id)
  where origin_ticket_id is not null;

create index if not exists tickets_raffle_status_idx
  on public.tickets (raffle_id, ticket_status);

/* Cualquier rifa ya cancelada conserva sus tickets como congelados. */
update public.tickets t
set
  ticket_status = 'frozen',
  frozen_at = coalesce(t.frozen_at, now())
from public.raffles r
where r.id = t.raffle_id
  and r.status = 'cancelled'
  and t.ticket_status = 'active';


-- ============================================================
-- Cancelar rifa: congela los tickets emitidos sin borrar ni reasignar nada.
-- ============================================================
create or replace function public.cancel_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.raffles%rowtype;
  v_updated public.raffles%rowtype;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select r.*
  into v_current
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current.status not in ('draft', 'active') then
    raise exception 'RAFFLE_NOT_CANCELLABLE' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.raffle_winners rw
    where rw.raffle_id = p_raffle_id
  ) then
    raise exception 'RAFFLE_HAS_WINNER' using errcode = '55000';
  end if;

  update public.purchase_requests pr
  set status = 'expired'
  where pr.raffle_id = p_raffle_id
    and pr.status = 'pending';

  update public.tickets t
  set
    ticket_status = 'frozen',
    frozen_at = coalesce(t.frozen_at, now())
  where t.raffle_id = p_raffle_id
    and t.ticket_status = 'active';

  update public.raffles r
  set
    status = 'cancelled',
    closed_at = now()
  where r.id = p_raffle_id
  returning * into v_updated;

  return v_updated;
end;
$$;


-- ============================================================
-- Reasignar un ticket congelado a la única rifa activa.
-- El ticket original no cambia de rifa ni de número: queda como historial.
-- ============================================================
create or replace function public.reassign_frozen_ticket(
  p_admin_user_id uuid,
  p_source_ticket_id uuid,
  p_target_raffle_id uuid
)
returns table (
  source_ticket_id uuid,
  reassigned_ticket_id uuid,
  reassigned_ticket_number integer,
  target_raffle_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.tickets%rowtype;
  v_source_raffle public.raffles%rowtype;
  v_target public.raffles%rowtype;
  v_next_ticket_number integer;
  v_new_ticket public.tickets%rowtype;
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_source_ticket_id is null or p_target_raffle_id is null then
    raise exception 'INVALID_REASSIGNMENT_ARGUMENTS' using errcode = '22023';
  end if;

  select t.*
  into v_source
  from public.tickets t
  where t.id = p_source_ticket_id
  for update;

  if not found then
    raise exception 'SOURCE_TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_source.ticket_status <> 'frozen' then
    raise exception 'SOURCE_TICKET_NOT_FROZEN' using errcode = 'P0001';
  end if;

  select r.*
  into v_source_raffle
  from public.raffles r
  where r.id = v_source.raffle_id
  for share;

  if not found or v_source_raffle.status <> 'cancelled' then
    raise exception 'SOURCE_RAFFLE_NOT_CANCELLED' using errcode = 'P0001';
  end if;

  if v_source.raffle_id = p_target_raffle_id then
    raise exception 'TARGET_RAFFLE_MUST_DIFFER' using errcode = '22023';
  end if;

  /* El mismo bloqueo que usa approve_purchase_request serializa cupos. */
  select r.*
  into v_target
  from public.raffles r
  where r.id = p_target_raffle_id
  for update;

  if not found then
    raise exception 'TARGET_RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target.status <> 'active' then
    raise exception 'TARGET_RAFFLE_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select coalesce(max(t.ticket_number), 0) + 1
  into v_next_ticket_number
  from public.tickets t
  where t.raffle_id = v_target.id;

  if v_next_ticket_number > v_target.total_tickets then
    raise exception 'TARGET_RAFFLE_SOLD_OUT' using errcode = 'P0001';
  end if;

  insert into public.tickets (
    raffle_id,
    purchase_request_id,
    ticket_number,
    ticket_status,
    origin_ticket_id
  )
  values (
    v_target.id,
    v_source.purchase_request_id,
    v_next_ticket_number,
    'active',
    v_source.id
  )
  returning * into v_new_ticket;

  update public.tickets t
  set
    ticket_status = 'reassigned',
    reassigned_at = now(),
    reassigned_by = p_admin_user_id
  where t.id = v_source.id;

  return query
  select
    v_source.id,
    v_new_ticket.id,
    v_new_ticket.ticket_number,
    v_target.name;
end;
$$;


-- Un ticket congelado o ya reasignado no puede imprimirse ni ganar.
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
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.user_id = p_admin_user_id and ap.is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_ACTIVE';
  end if;

  select t.* into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'TICKET_NOT_ACTIVE';
  end if;

  select pr.status into v_purchase_request_status
  from public.purchase_requests pr
  where pr.id = v_ticket.purchase_request_id;

  if v_purchase_request_status is distinct from 'approved' then
    raise exception using errcode = 'P0001', message = 'PURCHASE_REQUEST_NOT_APPROVED';
  end if;

  select s.max_reprints into v_max_reprints
  from public.app_settings s where s.id = true;

  if v_max_reprints is null then
    raise exception using errcode = 'P0001', message = 'APP_SETTINGS_NOT_FOUND';
  end if;

  select count(*)::integer into v_existing_prints
  from public.ticket_prints tp where tp.ticket_id = p_ticket_id;

  v_reprints_used := greatest(v_existing_prints - 1, 0);

  if v_existing_prints = 0 then
    v_print_type := 'original';
    v_print_sequence := 1;
    v_reason := null;
  else
    if v_reprints_used >= v_max_reprints then
      raise exception using errcode = 'P0001', message = 'MAX_REPRINTS_REACHED';
    end if;

    v_reason := nullif(trim(p_reason), '');
    if v_reason is null then
      raise exception using errcode = 'P0001', message = 'REPRINT_REASON_REQUIRED';
    end if;

    if length(v_reason) > 500 then
      raise exception using errcode = 'P0001', message = 'REPRINT_REASON_TOO_LONG';
    end if;

    v_print_type := 'reprint';
    v_print_sequence := v_existing_prints + 1;
  end if;

  insert into public.ticket_prints (
    ticket_id, print_type, print_sequence, printed_by, reason
  ) values (
    p_ticket_id, v_print_type, v_print_sequence, p_admin_user_id, v_reason
  ) returning * into v_print;

  return query
  select
    v_print.id, v_ticket.id, v_ticket.ticket_number, v_print.print_type,
    v_print.print_sequence, v_print.printed_at,
    case when v_print.print_type = 'original' then 0 else v_print.print_sequence - 1 end,
    v_max_reprints;
end;
$$;


create or replace function public.register_raffle_winner(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_ticket_number integer
)
returns public.raffle_winners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_ticket public.tickets%rowtype;
  v_winner public.raffle_winners%rowtype;
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_ticket_number is null or p_ticket_number <= 0 then
    raise exception 'INVALID_TICKET_NUMBER' using errcode = '22023';
  end if;

  select r.* into v_raffle
  from public.raffles r where r.id = p_raffle_id for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'closed' then
    raise exception 'RAFFLE_NOT_CLOSED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.raffle_winners w where w.raffle_id = p_raffle_id
  ) then
    raise exception 'RAFFLE_ALREADY_HAS_WINNER' using errcode = 'P0001';
  end if;

  select t.* into v_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id
    and t.ticket_number = p_ticket_number;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  insert into public.raffle_winners (raffle_id, ticket_id, confirmed_by)
  values (p_raffle_id, v_ticket.id, p_admin_user_id)
  returning * into v_winner;

  return v_winner;
end;
$$;


-- ============================================================
-- Consultas públicas: documento + código de seguimiento.
-- ============================================================
/*
 * Conserva las firmas antiguas solo para cerrarlas sin filtrar datos durante
 * el despliegue. La aplicación nueva usa las firmas de dos argumentos; el
 * sitio anterior recibirá un error controlado en vez de exponer datos por
 * conocer únicamente un DNI.
 */
create or replace function public.track_purchase_request(p_dni text)
returns table (
  request_id uuid,
  raffle_name text,
  request_status public.purchase_request_status,
  requested_at timestamptz,
  expires_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  ticket_numbers integer[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'PUBLIC_LOOKUP_REQUIRES_TRACKING_CODE' using errcode = '22023';
end;
$$;

create or replace function public.get_public_ticket_document(p_dni text)
returns table (
  request_id uuid,
  raffle_name text,
  full_name text,
  dni text,
  purchased_at timestamptz,
  ticket_numbers integer[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'PUBLIC_LOOKUP_REQUIRES_TRACKING_CODE' using errcode = '22023';
end;
$$;

create or replace function public.track_purchase_request(
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_name text,
  request_status public.purchase_request_status,
  requested_at timestamptz,
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
    pr.id,
    r.name,
    pr.status,
    pr.created_at,
    pr.expires_at,
    pr.reviewed_at,
    case when pr.status = 'rejected' then pr.rejection_reason else null end,
    coalesce(
      array_agg(t.ticket_number order by t.ticket_number)
        filter (
          where t.id is not null
            and t.raffle_id = pr.raffle_id
            and t.ticket_status = 'active'
        ),
      array[]::integer[]
    )
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and pr.tracking_code = public.normalize_tracking_code(p_tracking_code)
  group by pr.id, r.name, pr.status, pr.created_at, pr.expires_at,
    pr.reviewed_at, pr.rejection_reason;
$$;

create or replace function public.get_public_ticket_document(
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_name text,
  full_name text,
  dni text,
  purchased_at timestamptz,
  ticket_status public.ticket_lifecycle_status,
  ticket_numbers integer[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pr.id,
    r.name,
    pr.full_name,
    pr.dni,
    pr.created_at,
    t.ticket_status,
    array_agg(t.ticket_number order by t.ticket_number)
  from public.purchase_requests pr
  join public.tickets t on t.purchase_request_id = pr.id
  join public.raffles r on r.id = t.raffle_id
  where public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and pr.tracking_code = public.normalize_tracking_code(p_tracking_code)
    and pr.status = 'approved'
  group by pr.id, r.name, pr.full_name, pr.dni, pr.created_at, t.ticket_status
  order by pr.created_at desc, r.name;
$$;


-- ============================================================
-- Solo se eliminan borradores sin movimientos ni ganador.
-- ============================================================
create or replace function public.delete_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid
)
returns table (
  raffle_name text,
  raffle_status public.raffle_status,
  image_path text,
  prize_image_paths text[],
  payment_proof_paths text[],
  deleted_requests integer,
  deleted_tickets integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_prize_paths text[];
begin
  perform public.assert_active_admin(p_admin_user_id);

  select r.* into v_raffle
  from public.raffles r where r.id = p_raffle_id for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'draft' then
    raise exception 'RAFFLE_DELETE_ONLY_DRAFT' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.purchase_requests pr where pr.raffle_id = p_raffle_id)
     or exists (select 1 from public.tickets t where t.raffle_id = p_raffle_id)
     or exists (select 1 from public.raffle_winners rw where rw.raffle_id = p_raffle_id) then
    raise exception 'RAFFLE_DELETE_HAS_ACTIVITY' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(path), array[]::text[])
  into v_prize_paths
  from (
    select nullif(trim(elem->>'image_path'), '') as path
    from jsonb_array_elements(v_raffle.prizes) as elem
  ) prize_images
  where path is not null;

  delete from public.raffles r where r.id = p_raffle_id;

  return query
  select
    v_raffle.name,
    v_raffle.status,
    v_raffle.image_path,
    v_prize_paths,
    array[]::text[],
    0,
    0;
end;
$$;


revoke all on function public.cancel_raffle(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.reassign_frozen_ticket(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.register_ticket_print(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.register_raffle_winner(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.track_purchase_request(text, text)
  from public, anon, authenticated;
revoke all on function public.get_public_ticket_document(text, text)
  from public, anon, authenticated;
revoke all on function public.track_purchase_request(text)
  from public, anon, authenticated;
revoke all on function public.get_public_ticket_document(text)
  from public, anon, authenticated;
revoke all on function public.delete_raffle(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.cancel_raffle(uuid, uuid) to service_role;
grant execute on function public.reassign_frozen_ticket(uuid, uuid, uuid) to service_role;
grant execute on function public.register_ticket_print(uuid, uuid, text) to service_role;
grant execute on function public.register_raffle_winner(uuid, uuid, integer) to service_role;
grant execute on function public.track_purchase_request(text, text) to service_role;
grant execute on function public.get_public_ticket_document(text, text) to service_role;
grant execute on function public.track_purchase_request(text) to service_role;
grant execute on function public.get_public_ticket_document(text) to service_role;
grant execute on function public.delete_raffle(uuid, uuid) to service_role;
