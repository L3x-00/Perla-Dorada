-- ============================================================
-- Bloque G: rate limiting genérico y parametrizable
--
-- check_purchase_request_rate_limit tiene los límites fijos (5/15min,
-- 20/día) y solo sirve para el alta de solicitudes. Los endpoints
-- públicos de consulta (/api/tracking, /api/tickets) necesitan límites
-- propios y más laxos, sin consumir la cuota de creación.
--
-- Esta función reutiliza la misma tabla private.purchase_request_rate_limits
-- (el nombre es histórico; la tabla es genérica). La separación entre
-- ámbitos se logra en la aplicación incluyendo un `scope` en el HMAC del
-- fingerprint, de modo que cada ámbito usa claves distintas.
-- ============================================================

create or replace function public.check_rate_limit(
  p_fingerprint_hash text,
  p_short_limit integer,
  p_daily_limit integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  short_window_count integer,
  daily_window_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_short_window_start timestamptz;
  v_daily_window_start timestamptz;
  v_short_count integer;
  v_daily_count integer;
  v_short_retry integer := 0;
  v_daily_retry integer := 0;
begin
  if p_fingerprint_hash is null
     or length(trim(p_fingerprint_hash)) < 32 then
    raise exception 'Fingerprint inválido.'
      using errcode = '22023';
  end if;

  if p_short_limit is null or p_short_limit <= 0
     or p_daily_limit is null or p_daily_limit <= 0 then
    raise exception 'Límites inválidos.'
      using errcode = '22023';
  end if;

  v_short_window_start :=
    date_bin(
      interval '15 minutes',
      v_now,
      timestamptz '2000-01-01 00:00:00+00'
    );

  v_daily_window_start := date_trunc('day', v_now);

  insert into private.purchase_request_rate_limits (
    fingerprint_hash,
    window_type,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_fingerprint_hash,
    'fifteen_minutes',
    v_short_window_start,
    1,
    v_now
  )
  on conflict (
    fingerprint_hash,
    window_type,
    window_started_at
  )
  do update set
    request_count =
      private.purchase_request_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count
  into v_short_count;

  insert into private.purchase_request_rate_limits (
    fingerprint_hash,
    window_type,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_fingerprint_hash,
    'daily',
    v_daily_window_start,
    1,
    v_now
  )
  on conflict (
    fingerprint_hash,
    window_type,
    window_started_at
  )
  do update set
    request_count =
      private.purchase_request_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count
  into v_daily_count;

  if v_short_count > p_short_limit then
    v_short_retry :=
      greatest(
        1,
        ceil(
          extract(
            epoch from (
              v_short_window_start
              + interval '15 minutes'
              - v_now
            )
          )
        )::integer
      );
  end if;

  if v_daily_count > p_daily_limit then
    v_daily_retry :=
      greatest(
        1,
        ceil(
          extract(
            epoch from (
              v_daily_window_start
              + interval '1 day'
              - v_now
            )
          )
        )::integer
      );
  end if;

  return query
  select
    v_short_count <= p_short_limit
      and v_daily_count <= p_daily_limit,
    greatest(v_short_retry, v_daily_retry),
    v_short_count,
    v_daily_count;
end;
$$;

revoke all
  on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

grant execute
  on function public.check_rate_limit(text, integer, integer)
  to service_role;

comment on function public.check_rate_limit(text, integer, integer)
  is 'Rate limit genérico por fingerprint con límites parametrizables (ventana de 15 minutos y diaria). Uso exclusivo del backend.';
