-- ============================================================
-- Agrega raffle_status a get_public_ticket_document().
--
-- /seguimiento/tickets ahora agrupa por sorteo; si el sorteo de un grupo ya
-- no está activo (se cerró o se canceló), la persona debe poder seguir
-- viendo y descargando sus tickets, pero con un aviso claro de que el
-- sorteo ya no está vigente. Antes la función no exponía el estado de la
-- rifa, así que el frontend no tenía forma de saberlo.
--
-- El parámetro no cambia, pero el tipo de retorno sí (columna nueva), así
-- que hay que eliminar y recrear la función.
-- ============================================================

drop function if exists public.get_public_ticket_document(text, text, text);

create or replace function public.get_public_ticket_document(
  p_document_type text,
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_id uuid,
  raffle_name text,
  raffle_status public.raffle_status,
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
    r.id,
    r.name,
    r.status,
    pr.full_name,
    pr.dni,
    pr.created_at,
    t.ticket_status,
    array_agg(t.ticket_number order by t.ticket_number)
  from public.purchase_requests pr
  join public.tickets t on t.purchase_request_id = pr.id
  join public.raffles r on r.id = t.raffle_id
  where pr.document_type = lower(trim(p_document_type))::public.participant_document_type
    and public.normalize_document_number(pr.dni) = public.normalize_document_number(p_dni)
    and pr.status = 'approved'
    and (
      exists (
        select 1
        from public.participant_tracking_codes ptc
        where ptc.document_type = pr.document_type
          and ptc.document_number = public.normalize_document_number(pr.dni)
          and ptc.tracking_code = public.normalize_tracking_code(p_tracking_code)
      )
      or exists (
        select 1
        from public.participant_tracking_code_aliases ptca
        where ptca.document_type = pr.document_type
          and ptca.document_number = public.normalize_document_number(pr.dni)
          and ptca.tracking_code = public.normalize_tracking_code(p_tracking_code)
      )
    )
  group by pr.id, r.id, r.name, r.status, pr.full_name, pr.dni, pr.created_at, t.ticket_status
  order by pr.created_at desc, r.name;
$$;

revoke all
  on function public.get_public_ticket_document(text, text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text, text)
  to service_role;


-- ============================================================
-- Reserva de boletos: de 1 hora a 6 horas.
--
-- Decisión de negocio: 60 minutos resultaba muy corto para que un
-- participante complete el pago por Yape y suba el comprobante.
-- ============================================================

alter table public.app_settings
  alter column reservation_minutes set default 360;

update public.app_settings
  set reservation_minutes = 360
  where id = true;
