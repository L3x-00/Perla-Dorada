-- ============================================================
-- Agrega ticket_price y requested_quantity a get_public_ticket_document().
--
-- /seguimiento/tickets ahora muestra cada ticket como un cuadrado compacto
-- con el monto pagado por esa compra. Antes la función no exponía el precio
-- ni la cantidad, así que el frontend no podía calcularlo.
--
-- El parámetro no cambia, pero el tipo de retorno sí (columnas nuevas), así
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
  ticket_numbers integer[],
  ticket_price numeric,
  requested_quantity integer
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
    array_agg(t.ticket_number order by t.ticket_number),
    r.ticket_price,
    pr.requested_quantity
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
  group by pr.id, r.id, r.name, r.status, pr.full_name, pr.dni, pr.created_at, t.ticket_status, r.ticket_price, pr.requested_quantity
  order by pr.created_at desc, r.name;
$$;

revoke all
  on function public.get_public_ticket_document(text, text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text, text)
  to service_role;
