-- ============================================================
-- Corrige la fecha de ALFREDO ADOLFO TORRES RAMIRES.
--
-- En la planilla de importación manual (clientes.md) su fecha quedó como
-- "2026-08-31 21:42": una fecha futura/errónea (día tecleado 31 en vez de
-- 01). Su boleto #99 cae entre el #98 (01 ago 21:34) y el #100 (01 ago
-- 21:48), así que la compra real fue el 01 de agosto 21:42. La fecha
-- equivocada lo dejaba en la cima de "Solicitudes" y "Tickets", por encima
-- de las aprobaciones recientes. Se corrige solo ese registro y su ticket.
-- ============================================================

do $$
declare
  v_correct timestamptz := '2026-08-01 21:42'::timestamp at time zone 'America/Lima';
  v_request_id uuid;
begin
  select id
  into v_request_id
  from public.purchase_requests
  where full_name = 'ALFREDO ADOLFO TORRES RAMIRES'
    and dni = '90000004'
    and created_at = '2026-09-01T02:42:00+00:00';

  if v_request_id is null then
    raise notice 'Solicitud de ALFREDO con la fecha errónea no encontrada; nada que corregir.';
    return;
  end if;

  update public.purchase_requests
  set
    created_at = v_correct,
    reviewed_at = v_correct,
    updated_at = v_correct,
    expires_at = v_correct + interval '6 hours'
  where id = v_request_id;

  update public.tickets
  set assigned_at = v_correct
  where purchase_request_id = v_request_id;

  raise notice 'Fecha de ALFREDO corregida a %', v_correct;
end;
$$;
