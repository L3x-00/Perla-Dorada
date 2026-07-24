-- ============================================================
-- El documento público de tickets ahora expone la fecha y hora de compra
-- (purchase_requests.created_at) para imprimirla en cada ticket. El rediseño
-- del ticket ya no muestra precio, descripción, total ni código; en cambio sí
-- muestra cuándo se compró.
--
-- Cambia el tipo de retorno (columna nueva), así que se elimina y recrea.
-- ============================================================

drop function if exists public.get_public_ticket_document(text, text);

create or replace function public.get_public_ticket_document(
  p_dni text,
  p_tracking_code text
)
returns table (
  raffle_name text,
  raffle_description text,
  draw_at timestamptz,
  ticket_price numeric,
  full_name text,
  dni text,
  tracking_code text,
  purchased_at timestamptz,
  ticket_numbers integer[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.name,
    r.description,
    r.draw_at,
    r.ticket_price,
    pr.full_name,
    pr.dni,
    pr.tracking_code,
    pr.created_at,
    coalesce(
      array_agg(t.ticket_number order by t.ticket_number)
        filter (where t.ticket_number is not null),
      '{}'
    ) as ticket_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where pr.tracking_code =
        public.normalize_tracking_code(p_tracking_code)
    and public.normalize_document_number(pr.dni) =
        public.normalize_document_number(p_dni)
    and pr.status = 'approved'
  group by
    r.name,
    r.description,
    r.draw_at,
    r.ticket_price,
    pr.full_name,
    pr.dni,
    pr.tracking_code,
    pr.created_at;
$$;

revoke all
  on function public.get_public_ticket_document(text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text)
  to service_role;
