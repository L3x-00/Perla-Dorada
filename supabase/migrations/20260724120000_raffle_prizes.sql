-- ============================================================
-- 2.30 - PREMIOS MÚLTIPLES POR RIFA
--
-- Una rifa puede anunciar varios premios ("una moto", "2 x dinero en
-- efectivo", "un televisor Samsung"...), cada uno con su cantidad y una
-- foto opcional. Es información DESCRIPTIVA de marketing: no cambia la
-- regla de negocio de ganador único y manual (register_raffle_winner
-- sigue igual). Por eso se guarda como jsonb en la propia rifa y no como
-- tabla relacional: nadie referencia un premio individual.
--
-- Forma de cada elemento (tras normalizar):
--   { "title": text, "quantity": int >= 1, "image_path": text | null }
-- El orden del arreglo es el orden de presentación. La foto del "premio
-- mayor" sigue viviendo en raffles.image_path (flujo de subida existente).
-- ============================================================

alter table public.raffles
  add column if not exists prizes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'raffles_prizes_is_array'
      and conrelid = 'public.raffles'::regclass
  ) then
    alter table public.raffles
      add constraint raffles_prizes_is_array
      check (jsonb_typeof(prizes) = 'array');
  end if;
end;
$$;


-- ============================================================
-- NORMALIZADOR DE PREMIOS
--
-- Fuente de verdad de la forma y los límites. Se invoca desde
-- create_raffle y update_raffle, así que ni la ruta HTTP ni el navegador
-- pueden colar un premio malformado. Lanza 22023 (mapeado a 400) ante
-- cualquier dato inválido.
-- ============================================================

create or replace function public.normalize_raffle_prizes(
  p_prizes jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_quantity integer;
  v_image_path text;
  v_count integer := 0;
begin
  if p_prizes is null then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_prizes) <> 'array' then
    raise exception 'PRIZES_NOT_ARRAY'
      using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_prizes)
  loop
    v_count := v_count + 1;

    if v_count > 20 then
      raise exception 'TOO_MANY_PRIZES'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'PRIZE_NOT_OBJECT'
        using errcode = '22023';
    end if;

    v_title := nullif(trim(coalesce(v_item->>'title', '')), '');

    if v_title is null then
      raise exception 'PRIZE_TITLE_REQUIRED'
        using errcode = '22023';
    end if;

    if length(v_title) > 120 then
      raise exception 'PRIZE_TITLE_TOO_LONG'
        using errcode = '22023';
    end if;

    begin
      v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    exception
      when others then
        raise exception 'PRIZE_QUANTITY_INVALID'
          using errcode = '22023';
    end;

    if v_quantity < 1 or v_quantity > 100000 then
      raise exception 'PRIZE_QUANTITY_OUT_OF_RANGE'
        using errcode = '22023';
    end if;

    v_image_path :=
      nullif(trim(coalesce(v_item->>'image_path', '')), '');

    if v_image_path is not null and length(v_image_path) > 300 then
      raise exception 'PRIZE_IMAGE_PATH_TOO_LONG'
        using errcode = '22023';
    end if;

    v_result := v_result || jsonb_build_object(
      'title', v_title,
      'quantity', v_quantity,
      'image_path', v_image_path
    );
  end loop;

  return v_result;
end;
$$;


-- ============================================================
-- Se reescriben create_raffle / update_raffle / delete_raffle para
-- entender premios. Cambian de firma (create/update) o de tipo de
-- retorno (delete), así que se elimina la versión anterior primero.
-- ============================================================

drop function if exists public.create_raffle(
  uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz
);

drop function if exists public.update_raffle(
  uuid, uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz
);

drop function if exists public.delete_raffle(uuid, uuid);


-- ------------------------------------------------------------
-- CREAR RIFA (con foto de premio mayor y lista de premios)
-- Siempre nace como draft. p_image_path y p_prizes son opcionales
-- para no romper llamadas positionales antiguas.
-- ------------------------------------------------------------

create or replace function public.create_raffle(
  p_admin_user_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz,
  p_image_path text default null,
  p_prizes jsonb default '[]'::jsonb
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
  v_image_path text :=
    nullif(trim(coalesce(p_image_path, '')), '');
  v_prizes jsonb :=
    public.normalize_raffle_prizes(p_prizes);
begin
  perform public.assert_active_admin(p_admin_user_id);

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT' using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;

  if p_ticket_price is null or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = '22023';
  end if;

  if p_total_tickets is null or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS' using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH' using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception 'CLOSES_AT_MUST_BE_AFTER_STARTS_AT' using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception 'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT' using errcode = '22023';
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
    image_path,
    prizes,
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
    v_image_path,
    v_prizes,
    p_admin_user_id
  )
  returning *
  into v_raffle;

  return v_raffle;
end;
$$;


-- ------------------------------------------------------------
-- ACTUALIZAR RIFA (incluye la lista de premios; la foto del premio
-- mayor se gestiona aparte en /api/admin/raffles/[id]/image)
-- ------------------------------------------------------------

create or replace function public.update_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_name text,
  p_description text,
  p_ticket_price numeric,
  p_total_tickets integer,
  p_starts_at timestamptz,
  p_closes_at timestamptz,
  p_draw_at timestamptz,
  p_prizes jsonb default '[]'::jsonb
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
  v_prizes jsonb :=
    public.normalize_raffle_prizes(p_prizes);
  v_max_assigned_ticket integer;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select *
  into v_current
  from public.raffles
  where id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current.status not in ('draft', 'active') then
    raise exception 'RAFFLE_NOT_EDITABLE' using errcode = '55000';
  end if;

  if length(v_name) < 3 then
    raise exception 'RAFFLE_NAME_TOO_SHORT' using errcode = '22023';
  end if;

  if length(v_name) > 150 then
    raise exception 'RAFFLE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 2000 then
    raise exception 'RAFFLE_DESCRIPTION_TOO_LONG' using errcode = '22023';
  end if;

  if p_ticket_price is null or p_ticket_price <= 0 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = '22023';
  end if;

  if p_total_tickets is null or p_total_tickets <= 0 then
    raise exception 'INVALID_TOTAL_TICKETS' using errcode = '22023';
  end if;

  if p_total_tickets > 1000000 then
    raise exception 'TOTAL_TICKETS_TOO_HIGH' using errcode = '22023';
  end if;

  if p_starts_at is not null
     and p_closes_at is not null
     and p_closes_at <= p_starts_at then
    raise exception 'CLOSES_AT_MUST_BE_AFTER_STARTS_AT' using errcode = '22023';
  end if;

  if p_closes_at is not null
     and p_draw_at is not null
     and p_draw_at < p_closes_at then
    raise exception 'DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT' using errcode = '22023';
  end if;

  if p_ticket_price <> v_current.ticket_price
     and exists (
       select 1
       from public.purchase_requests pr
       where pr.raffle_id = p_raffle_id
     ) then
    raise exception 'TICKET_PRICE_LOCKED' using errcode = '55000';
  end if;

  select max(t.ticket_number)
  into v_max_assigned_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id;

  if v_max_assigned_ticket is not null
     and p_total_tickets < v_max_assigned_ticket then
    raise exception 'TOTAL_TICKETS_BELOW_ASSIGNED_MAX' using errcode = '22023';
  end if;

  update public.raffles
  set
    name = v_name,
    description = v_description,
    ticket_price = p_ticket_price,
    total_tickets = p_total_tickets,
    starts_at = p_starts_at,
    closes_at = p_closes_at,
    draw_at = p_draw_at,
    prizes = v_prizes
  where id = p_raffle_id
  returning *
  into v_updated;

  return v_updated;
end;
$$;


-- ------------------------------------------------------------
-- ELIMINAR RIFA (ahora también devuelve las rutas de las fotos de los
-- premios para que el backend las borre del bucket público)
-- ------------------------------------------------------------

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
  v_paths text[];
  v_requests integer;
  v_tickets integer;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select *
  into v_raffle
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  /* Fotos de los premios que viven en el bucket público. */
  select coalesce(
    array_agg(path),
    array[]::text[]
  )
  into v_prize_paths
  from (
    select nullif(trim(elem->>'image_path'), '') as path
    from jsonb_array_elements(v_raffle.prizes) as elem
  ) prize_images
  where path is not null;

  /* Comprobantes todavía presentes en Storage. */
  select coalesce(
    array_agg(pr.payment_proof_path),
    array[]::text[]
  )
  into v_paths
  from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id
    and pr.payment_proof_deleted_at is null
    and nullif(trim(pr.payment_proof_path), '') is not null;

  select count(*)::integer
  into v_tickets
  from public.tickets t
  where t.raffle_id = p_raffle_id;

  select count(*)::integer
  into v_requests
  from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id;

  -- Habilita el borrado del ganador solo para esta rifa y transacción.
  perform set_config('app.purging_raffle_id', p_raffle_id::text, true);

  delete from public.ticket_prints tp
  where tp.ticket_id in (
    select t.id
    from public.tickets t
    where t.raffle_id = p_raffle_id
  );

  delete from public.raffle_winners rw
  where rw.raffle_id = p_raffle_id;

  delete from public.tickets t
  where t.raffle_id = p_raffle_id;

  delete from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id;

  delete from public.raffles r
  where r.id = p_raffle_id;

  perform set_config('app.purging_raffle_id', '', true);

  return query
  select
    v_raffle.name,
    v_raffle.status,
    v_raffle.image_path,
    v_prize_paths,
    v_paths,
    v_requests,
    v_tickets;
end;
$$;


-- ============================================================
-- PERMISOS (sin RLS: REVOKE ALL + SECURITY DEFINER, solo service_role)
-- ============================================================

revoke all
on function public.normalize_raffle_prizes(jsonb)
from public, anon, authenticated;

revoke all
on function public.create_raffle(
  uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz, text, jsonb
)
from public, anon, authenticated;

revoke all
on function public.update_raffle(
  uuid, uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz, jsonb
)
from public, anon, authenticated;

revoke all
on function public.delete_raffle(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.normalize_raffle_prizes(jsonb)
to service_role;

grant execute
on function public.create_raffle(
  uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz, text, jsonb
)
to service_role;

grant execute
on function public.update_raffle(
  uuid, uuid, text, text, numeric, integer,
  timestamptz, timestamptz, timestamptz, jsonb
)
to service_role;

grant execute
on function public.delete_raffle(uuid, uuid)
to service_role;

comment on function public.delete_raffle(uuid, uuid)
  is 'DESTRUCTIVO: elimina una rifa y todo lo que cuelga de ella (solicitudes, tickets, impresiones, ganador) y devuelve las rutas de Storage a limpiar (comprobantes + fotos de premios).';
