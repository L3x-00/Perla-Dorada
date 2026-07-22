-- ============================================================
-- Rate limiting distribuido para solicitudes públicas
-- ============================================================

create schema if not exists private;

revoke all on schema private
from public, anon, authenticated;

create table private.purchase_request_rate_limits (
  fingerprint_hash text not null,
  window_type text not null
    check (window_type in ('fifteen_minutes', 'daily')),
  window_started_at timestamptz not null,
  request_count integer not null default 1
    check (request_count > 0),
  updated_at timestamptz not null default now(),

  primary key (
    fingerprint_hash,
    window_type,
    window_started_at
  )
);

create index purchase_request_rate_limits_updated_at_idx
on private.purchase_request_rate_limits (updated_at);

alter table private.purchase_request_rate_limits
enable row level security;

create or replace function public.check_purchase_request_rate_limit(
  p_fingerprint_hash text
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

  if v_short_count > 5 then
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

  if v_daily_count > 20 then
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
    v_short_count <= 5
      and v_daily_count <= 20,
    greatest(v_short_retry, v_daily_retry),
    v_short_count,
    v_daily_count;
end;
$$;

revoke all
on function public.check_purchase_request_rate_limit(text)
from public, anon, authenticated;

grant execute
on function public.check_purchase_request_rate_limit(text)
to service_role;

comment on function
  public.check_purchase_request_rate_limit(text)
is
  'Registra un intento y aplica límites de 5 cada 15 minutos y 20 diarios. Solo backend.';

grant usage on schema private
to service_role;

grant select, insert, update, delete
on table private.purchase_request_rate_limits
to service_role;