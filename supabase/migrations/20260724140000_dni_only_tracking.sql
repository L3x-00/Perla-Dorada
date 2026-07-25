-- ============================================================
-- Consulta pública SOLO por DNI (sin código de seguimiento)
--
-- Antes, "consultar mi solicitud" y "descargar mis tickets" pedían DNI +
-- código de seguimiento y devolvían UNA sola solicitud. Ahora piden solo el
-- documento y devuelven TODAS las solicitudes de ese documento (una persona
-- puede tener varias compras aprobadas, rechazadas o pendientes a la vez
-- desde que se quitó el límite de "una solicitud pendiente por DNI").
--
-- Cambia la firma (se quita p_tracking_code) y el resultado pasa de una fila
-- a un conjunto, así que se eliminan y recrean ambas funciones.
--
-- Nota de exposición: el código de seguimiento ya no protege esta consulta.
-- Quien conozca un DNI puede ver el estado de sus solicitudes y, si hay
-- alguna aprobada, el nombre completo y los números de ticket asignados. Es
-- una decisión de producto (facilita el flujo al participante); el rate
-- limit por IP sigue siendo la única barrera contra fuerza bruta/enumeración
-- y no cambia con esta migración.
-- ============================================================

drop function if exists public.track_purchase_request(text, text);
drop function if exists public.get_public_ticket_document(text, text);


create or replace function public.track_purchase_request(
  p_dni text
)
returns table (
  request_id uuid,
  raffle_name text,
  request_status public.purchase_request_status,
  requested_at timestamptz,
  expires_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  ticket_numbers integer[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pr.id as request_id,
    r.name as raffle_name,
    pr.status as request_status,
    pr.created_at as requested_at,
    pr.expires_at,
    pr.reviewed_at,

    case
      when pr.status = 'rejected'
        then pr.rejection_reason
      else null
    end as rejection_reason,

    coalesce(
      array_agg(
        t.ticket_number
        order by t.ticket_number
      ) filter (
        where
          t.id is not null
          and pr.status = 'approved'
      ),
      array[]::integer[]
    ) as ticket_numbers

  from public.purchase_requests pr

  inner join public.raffles r
    on r.id = pr.raffle_id

  left join public.tickets t
    on t.purchase_request_id = pr.id

  where public.normalize_document_number(pr.dni) =
        public.normalize_document_number(p_dni)

  group by
    pr.id,
    r.name,
    pr.status,
    pr.created_at,
    pr.expires_at,
    pr.reviewed_at,
    pr.rejection_reason

  order by pr.created_at desc;
$$;

revoke all
  on function public.track_purchase_request(text)
  from public, anon, authenticated;

grant execute
  on function public.track_purchase_request(text)
  to service_role;


create or replace function public.get_public_ticket_document(
  p_dni text
)
returns table (
  request_id uuid,
  raffle_name text,
  full_name text,
  dni text,
  purchased_at timestamptz,
  ticket_numbers integer[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id as request_id,
    r.name,
    pr.full_name,
    pr.dni,
    pr.created_at,
    coalesce(
      array_agg(t.ticket_number order by t.ticket_number)
        filter (where t.ticket_number is not null),
      '{}'
    ) as ticket_numbers
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  left join public.tickets t on t.purchase_request_id = pr.id
  where public.normalize_document_number(pr.dni) =
        public.normalize_document_number(p_dni)
    and pr.status = 'approved'
  group by
    pr.id,
    r.name,
    pr.full_name,
    pr.dni,
    pr.created_at
  having count(t.id) > 0
  order by pr.created_at desc;
$$;

revoke all
  on function public.get_public_ticket_document(text)
  from public, anon, authenticated;

grant execute
  on function public.get_public_ticket_document(text)
  to service_role;
