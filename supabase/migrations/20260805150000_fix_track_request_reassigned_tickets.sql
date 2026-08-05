-- ============================================================
-- track_purchase_request contaba los tickets vigentes de una solicitud
-- exigiendo además que vivieran en purchase_requests.raffle_id (la rifa
-- ORIGINAL de la solicitud). reassign_frozen_ticket nunca actualiza esa
-- columna al mover un ticket a una rifa activa nueva (solo toca la fila
-- de tickets), así que un ticket reasignado y vigente quedaba fuera del
-- conteo: /seguimiento decía "0 tickets vigentes" para una solicitud que
-- sí tenía uno participando en la rifa activa. Mismo patrón que ya se
-- corrigió para void_purchase_request_tickets (20260805120000): lo que
-- importa es dónde vive el ticket HOY, no la rifa original de la
-- solicitud. get_public_ticket_document ya hacía esto bien (se une por
-- t.raffle_id, no por pr.raffle_id) — aquí se alinea track_purchase_request
-- al mismo criterio.
--
-- Firma sin cambios: create or replace, sin drop, función stable de solo
-- lectura. No borra ni muta ninguna fila.
-- ============================================================

create or replace function public.track_purchase_request(
  p_document_type text, p_dni text, p_tracking_code text
)
returns table (request_id uuid, raffle_name text, request_status public.purchase_request_status, requested_at timestamptz, expires_at timestamptz, reviewed_at timestamptz, rejection_reason text, ticket_numbers integer[])
language sql security definer set search_path = '' stable
as $$
  select pr.id, r.name, pr.status, pr.created_at, pr.expires_at, pr.reviewed_at,
    case when pr.status = 'rejected' then pr.rejection_reason else null end,
    coalesce(array_agg(t.ticket_number order by t.ticket_number) filter (where t.id is not null and t.ticket_status = 'active'), array[]::integer[])
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

comment on function public.track_purchase_request(text, text, text)
  is 'Consulta pública de estado por documento + código de seguimiento. ticket_numbers cuenta tickets vigentes vivan en la rifa que vivan (no solo en la rifa original de la solicitud). raffle_name sigue mostrando la rifa original de la solicitud.';
