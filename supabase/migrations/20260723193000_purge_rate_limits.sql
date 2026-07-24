-- ============================================================
-- Purga de la tabla de rate limiting
--
-- private.purchase_request_rate_limits acumula 2 filas por cada
-- fingerprint y ventana (15 min + diaria) en cada petición, y nunca se
-- borraban. En uso normal crece de forma monótona para siempre; bajo un
-- pico de tráfico anónimo es una fuente de inserciones que puede llenar el
-- disco de la instancia y dejar la base en solo-lectura.
--
-- Las ventanas ya vencidas no sirven para nada: una vez pasada la ventana
-- de 15 min o el día, esas filas no vuelven a consultarse. Se conservan 2
-- días de margen por seguridad y se borra el resto. El índice sobre
-- updated_at hace el DELETE barato.
--
-- La ejecuta el cron diario de retención (service_role); no añade
-- infraestructura nueva.
-- ============================================================

create or replace function public.purge_rate_limits(
  p_retention_days integer default 2
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.purchase_request_rate_limits
  where updated_at <
        now() - make_interval(days => greatest(p_retention_days, 1));

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all
  on function public.purge_rate_limits(integer)
  from public, anon, authenticated;

grant execute
  on function public.purge_rate_limits(integer)
  to service_role;

comment on function public.purge_rate_limits(integer)
  is 'Borra las filas de rate limiting cuya última actualización es anterior a N días (por defecto 2). Uso exclusivo del backend, desde el cron de retención.';
