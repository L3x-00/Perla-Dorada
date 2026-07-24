-- ============================================================
-- Documento del participante: DNI o CUI (extranjeros)
--
-- Hasta ahora `purchase_requests.dni` era varchar(8) con CHECK de 8
-- dígitos, lo que impedía registrar a participantes extranjeros.
--
-- Se añade `document_type` y la columna pasa a guardar el número del
-- documento sea cual sea su tipo. NO se renombra la columna a propósito:
-- `dni` está referenciada por RPC públicos, tipos generados y la UI, y
-- renombrarla obligaría a tocar todo el sistema sin ganancia funcional.
--
-- Además se elimina el índice único que impedía más de una solicitud
-- pendiente por documento: el cliente puede comprar boletos en varias
-- tandas y quedar con varias solicitudes en cola. El abuso se contiene
-- con el rate limit del endpoint y con un tope por documento dentro de
-- create_purchase_request (ver migración siguiente).
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'participant_document_type'
      and n.nspname = 'public'
  ) then
    create type public.participant_document_type as enum ('dni', 'cui');
  end if;
end;
$$;

alter table public.purchase_requests
  add column if not exists document_type public.participant_document_type
    not null default 'dni';

-- El CHECK antiguo debe caer antes de ampliar el tipo de la columna.
alter table public.purchase_requests
  drop constraint if exists purchase_requests_dni_format;

alter table public.purchase_requests
  alter column dni type varchar(20);

alter table public.purchase_requests
  drop constraint if exists purchase_requests_document_number_format;

alter table public.purchase_requests
  add constraint purchase_requests_document_number_format
    check (
      (document_type = 'dni' and dni ~ '^[0-9]{8}$')
      or
      (document_type = 'cui' and dni ~ '^[A-Z0-9]{6,20}$')
    );

comment on column public.purchase_requests.dni
  is 'Número del documento de identidad. Su formato depende de document_type: 8 dígitos si es DNI, alfanumérico 6-20 si es CUI.';

comment on column public.purchase_requests.document_type
  is 'Tipo de documento: dni (peruano) o cui (participante extranjero).';

-- Se permiten varias solicitudes pendientes por documento y rifa.
drop index if exists public.purchase_requests_one_pending_dni_idx;

-- Soporta el conteo de pendientes por documento dentro del RPC.
create index if not exists purchase_requests_raffle_document_status_idx
  on public.purchase_requests (raffle_id, dni, status);

-- ============================================================
-- Normalización compartida
--
-- Las consultas públicas comparan lo que el usuario escribe contra lo
-- almacenado. Estas funciones garantizan que ambos lados se comparen
-- igual: sin espacios ni guiones y en mayúsculas.
--
-- El código de seguimiento usa el alfabeto Crockford Base32, que excluye
-- I, L, O y U precisamente porque se confunden al leerlas. Al normalizar
-- se traducen I y L a 1, y O a 0, que es lo que el usuario quiso escribir.
-- ============================================================

create or replace function public.normalize_document_number(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(
    regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g')
  );
$$;

create or replace function public.normalize_tracking_code(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    upper(regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g')),
    'ILO',
    '110'
  );
$$;

comment on function public.normalize_document_number(text)
  is 'Normaliza un número de documento: quita separadores y pasa a mayúsculas.';

comment on function public.normalize_tracking_code(text)
  is 'Normaliza un código de seguimiento Crockford Base32: quita separadores, pasa a mayúsculas y traduce I/L→1 y O→0.';

revoke all on function public.normalize_document_number(text)
  from public, anon, authenticated;

revoke all on function public.normalize_tracking_code(text)
  from public, anon, authenticated;

grant execute on function public.normalize_document_number(text)
  to service_role;

grant execute on function public.normalize_tracking_code(text)
  to service_role;
