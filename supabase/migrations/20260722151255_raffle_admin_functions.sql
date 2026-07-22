-- ============================================================
-- 2.20 - ADMINISTRACIÓN DE RIFAS
-- ============================================================

-- Garantía de base de datos: solo una rifa puede estar activa.
create unique index if not exists raffles_only_one_active_idx
on public.raffles (status)
where status = 'active';


-- ============================================================
-- VALIDACIÓN DE ADMINISTRADOR
-- ============================================================

create or replace function public.assert_active_admin(
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_admin_user_id is null then
    raise exception 'ADMIN_NOT_ACTIVE'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = p_admin_user_id
      and ap.is_active = true
  ) then
    raise exception 'ADMIN_NOT_ACTIVE'
      using errcode = '42501';
  end if;
end;
$$;


-- ============================================================
-- CREAR RIFA
-- Siempre se crea como draft.
-- ============================================================

create or replace function public.create_raffle(
  p_admin_user_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles;
  v_name text := trim(coalesce(p_name, ''));
  v_description text :=
    nullif(trim(coalesce(p_description, '')), '');
begin
  perform public.assert_active_admin(
    p_admin_user_id
  );

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT'
      using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG'
      using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG'
      using errcode = '22023';
  end if;

  if p_ticket_price is null
     or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE'
      using errcode = '22023';
  end if;

  if p_total_tickets is null
     or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS'
      using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH'
      using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception
      'CLOSES_AT_MUST_BE_AFTER_STARTS_AT'
      using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception
      'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT'
      using errcode = '22023';
  end if;

  insert into public.raffles (
    name,
    description,
    status,
    ticket_price,
    total_tickets,
    starts_at,
    closes_at,
    draw_at,
    created_by
  )
  values (
    v_name,
    v_description,
    'draft',
    p_ticket_price,
    p_total_tickets,
    p_starts_at,
    p_closes_at,
    p_draw_at,
    p_admin_user_id
  )
  returning *
  into v_raffle;

  return v_raffle;
end;
$$;


-- ============================================================
-- ACTUALIZAR RIFA
-- Solo draft o active.
-- ============================================================

create or replace function public.update_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.raffles;
  v_updated public.raffles;
  v_name text := trim(coalesce(p_name, ''));
  v_description text :=
    nullif(trim(coalesce(p_description, '')), '');
  v_max_assigned_ticket integer;
begin
  perform public.assert_active_admin(
    p_admin_user_id
  );

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_current.status not in (
    'draft',
    'active'
  ) then
    raise exception 'RAFFLE_NOT_EDITABLE'
      using errcode = '55000';
  end if;

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT'
      using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG'
      using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG'
      using errcode = '22023';
  end if;

  if p_ticket_price is null
     or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE'
      using errcode = '22023';
  end if;

  if p_total_tickets is null
     or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS'
      using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH'
      using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception
      'CLOSES_AT_MUST_BE_AFTER_STARTS_AT'
      using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception
      'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT'
      using errcode = '22023';
  end if;

  if p_ticket_price <> v_current.ticket_price
     and exists (
       select 1
       from public.purchase_requests pr
       where pr.raffle_id = p_raffle_id
     ) then
    raise exception 'TICKET_PRICE_LOCKED'
      using errcode = '55000';
  end if;

  select max(t.ticket_number)
  into v_max_assigned_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id;

  if v_max_assigned_ticket is not null
     and p_total_tickets <
         v_max_assigned_ticket then
    raise exception
      'TOTAL_TICKETS_BELOW_ASSIGNED_MAX'
      using errcode = '22023';
  end if;

  update public.raffles
  set
    name = v_name,
    description = v_description,
    ticket_price = p_ticket_price,
    total_tickets = p_total_tickets,
    starts_at = p_starts_at,
    closes_at = p_closes_at,
    draw_at = p_draw_at
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;
end;
$$;


-- ============================================================
-- ACTIVAR RIFA
-- ============================================================

create or replace function public.activate_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.raffles;
  v_updated public.raffles;
begin
  perform public.assert_active_admin(
    p_admin_user_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      'public.raffles.single_active'
    )
  );

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'RAFFLE_NOT_DRAFT'
      using errcode = '55000';
  end if;

  if v_current.closes_at is null then
    raise exception
      'RAFFLE_CLOSE_DATE_REQUIRED'
      using errcode = '22023';
  end if;

  if v_current.draw_at is null then
    raise exception
      'RAFFLE_DRAW_DATE_REQUIRED'
      using errcode = '22023';
  end if;

  if coalesce(
       v_current.starts_at,
       now()
     ) >= v_current.closes_at then
    raise exception
      'CLOSES_AT_MUST_BE_AFTER_STARTS_AT'
      using errcode = '22023';
  end if;

  if v_current.draw_at <
     v_current.closes_at then
    raise exception
      'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.raffles r
    where r.status = 'active'
      and r.id <> p_raffle_id
  ) then
    raise exception
      'ANOTHER_ACTIVE_RAFFLE_EXISTS'
      using errcode = '23505';
  end if;

  update public.raffles
  set
    status = 'active',
    starts_at = coalesce(
      starts_at,
      now()
    ),
    closed_at = null
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;

exception
  when unique_violation then
    raise exception
      'ANOTHER_ACTIVE_RAFFLE_EXISTS'
      using errcode = '23505';
end;
$$;


-- ============================================================
-- CERRAR RIFA
-- ============================================================

create or replace function public.close_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid
)
returns public.raffles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.raffles;
  v_updated public.raffles;
begin
  perform public.assert_active_admin(
    p_admin_user_id
  );

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_current.status <> 'active' then
    raise exception 'RAFFLE_NOT_ACTIVE'
      using errcode = '55000';
  end if;

  update public.purchase_requests
  set status = 'expired'
  where raffle_id = p_raffle_id
    and status = 'pending';

  update public.raffles
  set
    status = 'closed',
    closed_at = now()
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;
end;
$$;


-- ============================================================
-- CANCELAR RIFA
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
  v_current public.raffles;
  v_updated public.raffles;
begin
  perform public.assert_active_admin(
    p_admin_user_id
  );

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_current.status not in (
    'draft',
    'active'
  ) then
    raise exception
      'RAFFLE_NOT_CANCELLABLE'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.raffle_winners rw
    where rw.raffle_id = p_raffle_id
  ) then
    raise exception 'RAFFLE_HAS_WINNER'
      using errcode = '55000';
  end if;

  update public.purchase_requests
  set status = 'expired'
  where raffle_id = p_raffle_id
    and status = 'pending';

  update public.raffles
  set
    status = 'cancelled',
    closed_at = now()
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;
end;
$$;


-- ============================================================
-- PERMISOS
-- ============================================================

revoke all
on function public.assert_active_admin(uuid)
from public, anon, authenticated;

revoke all
on function public.create_raffle(
  uuid,
  text,
  text,
  numeric,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function public.update_raffle(
  uuid,
  uuid,
  text,
  text,
  numeric,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function public.activate_raffle(
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.close_raffle(
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.cancel_raffle(
  uuid,
  uuid
)
from public, anon, authenticated;


grant execute
on function public.assert_active_admin(uuid)
to service_role;

grant execute
on function public.create_raffle(
  uuid,
  text,
  text,
  numeric,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
)
to service_role;

grant execute
on function public.update_raffle(
  uuid,
  uuid,
  text,
  text,
  numeric,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
)
to service_role;

grant execute
on function public.activate_raffle(
  uuid,
  uuid
)
to service_role;

grant execute
on function public.close_raffle(
  uuid,
  uuid
)
to service_role;

grant execute
on function public.cancel_raffle(
  uuid,
  uuid
)
to service_role;