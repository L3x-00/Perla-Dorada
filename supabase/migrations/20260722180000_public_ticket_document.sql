-- ============================================================
-- Bloque D: documento público de tickets
--
-- Devuelve los datos necesarios para imprimir los tickets de una
-- solicitud APROBADA, validando DNI + tracking_code. Si la solicitud
-- no existe, no está aprobada o los datos no coinciden, no devuelve
-- filas. Solo ejecutable por el backend (service_role).
--
-- No expone datos de otras solicitudes ni permite enumerar: requiere
-- la combinación exacta DNI + tracking_code.
-- ============================================================

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
    coalesce(
      array_agg(t.ticket_number order by t.ticket_number)
        filter (where t.ticket_number is not null),
      '{}'
    ) as ticket_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where pr.dni = p_dni
    and upper(pr.tracking_code) = upper(p_tracking_code)
    and pr.status = 'approved'
  group by
    r.name,
    r.description,
    r.draw_at,
    r.ticket_price,
    pr.full_name,
    pr.dni,
    pr.tracking_code;
$$;

revoke all
  on function public.get_public_ticket_document(text, text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text, text)
  to service_role;

comment on function public.get_public_ticket_document(text, text)
  is 'Devuelve el documento imprimible de tickets de una solicitud aprobada, validando DNI + tracking_code. Uso exclusivo del backend.';
