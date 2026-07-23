-- ============================================================
-- Bloque F: retención de comprobantes
--
-- Lista las solicitudes cuyos comprobantes son elegibles para
-- eliminación: pertenecen a una rifa cerrada o cancelada hace al menos
-- p_retention_days días (por defecto 15) y cuyo comprobante aún no fue
-- eliminado (payment_proof_deleted_at is null).
--
-- La eliminación real del objeto en Storage y el marcado de
-- payment_proof_deleted_at los realiza el backend (service_role), porque
-- PostgreSQL no puede borrar objetos de Storage. Esta función solo
-- selecciona candidatos, de forma idempotente.
-- ============================================================

create or replace function public.list_payment_proofs_for_retention(
  p_retention_days integer default 15
)
returns table (
  request_id uuid,
  payment_proof_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.payment_proof_path
  from public.purchase_requests pr
  join public.raffles r on r.id = pr.raffle_id
  where pr.payment_proof_deleted_at is null
    and r.status in ('closed', 'cancelled')
    and r.closed_at is not null
    and r.closed_at <= now() - make_interval(days => greatest(p_retention_days, 0))
  order by r.closed_at
  limit 500;
$$;

revoke all
  on function public.list_payment_proofs_for_retention(integer)
  from public, anon, authenticated;

grant execute
  on function public.list_payment_proofs_for_retention(integer)
  to service_role;

comment on function public.list_payment_proofs_for_retention(integer)
  is 'Devuelve comprobantes elegibles para retención (rifa cerrada/cancelada hace >= N días, comprobante no eliminado). Uso exclusivo del backend.';
