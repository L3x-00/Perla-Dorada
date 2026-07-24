-- ============================================================
-- Borrado administrativo: rifas completas y comprobantes sueltos
--
-- Necesario durante la fase de pruebas: quedan rifas de ensayo y
-- comprobantes con fotos equivocadas que hay que sacar de la base y del
-- bucket, no solo ocultar.
--
-- PostgreSQL no puede borrar objetos de Storage, así que estas funciones
-- borran las filas y DEVUELVEN las rutas de los objetos para que el
-- backend (service_role) las elimine del bucket a continuación. Si esa
-- segunda parte falla, quedan objetos huérfanos sin fila que los
-- referencie: es el modo de fallo aceptado, y queda en el log.
--
-- ADVERTENCIA: delete_raffle es destructivo e irreversible. Elimina la
-- rifa, sus solicitudes, sus tickets, el historial de impresiones y el
-- ganador registrado. No hay papelera.
-- ============================================================


-- ============================================================
-- Excepción controlada a la inmutabilidad del ganador
--
-- El trigger sigue bloqueando cualquier UPDATE y cualquier DELETE
-- suelto sobre raffle_winners. Solo lo permite cuando la transacción en
-- curso está purgando esa rifa completa, marcada por delete_raffle con
-- un ajuste local a la transacción. No existe forma de borrar un ganador
-- conservando su rifa.
-- ============================================================

create or replace function public.prevent_raffle_winner_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and nullif(
           current_setting('app.purging_raffle_id', true),
           ''
         ) = old.raffle_id::text then
    return old;
  end if;

  raise exception
    'El ganador confirmado de una rifa es inmutable.';
end;
$$;


-- ============================================================
-- ELIMINAR UN COMPROBANTE
--
-- Idempotente: si ya estaba marcado como eliminado, devuelve la ruta de
-- todos modos (already_deleted = true) para que el backend pueda
-- reintentar el borrado en Storage sin efectos secundarios.
-- ============================================================

create or replace function public.delete_payment_proof(
  p_admin_user_id uuid,
  p_request_id uuid
)
returns table (
  payment_proof_path text,
  already_deleted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.purchase_requests%rowtype;
  v_already boolean;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select *
  into v_request
  from public.purchase_requests pr
  where pr.id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  v_already := v_request.payment_proof_deleted_at is not null;

  if not v_already then
    update public.purchase_requests as pr
    set payment_proof_deleted_at = now()
    where pr.id = p_request_id;
  end if;

  return query
  select v_request.payment_proof_path, v_already;
end;
$$;


-- ============================================================
-- ELIMINAR UNA RIFA COMPLETA
--
-- Orden de borrado impuesto por las claves foráneas, todas declaradas
-- ON DELETE RESTRICT: impresiones → ganador → tickets → solicitudes →
-- rifa. Todo dentro de la misma transacción del RPC.
-- ============================================================

create or replace function public.delete_raffle(
  p_admin_user_id uuid,
  p_raffle_id uuid
)
returns table (
  raffle_name text,
  raffle_status public.raffle_status,
  image_path text,
  payment_proof_paths text[],
  deleted_requests integer,
  deleted_tickets integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_paths text[];
  v_requests integer;
  v_tickets integer;
begin
  perform public.assert_active_admin(p_admin_user_id);

  select *
  into v_raffle
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  /*
   * Rutas de los comprobantes todavía presentes en Storage. Las ya
   * marcadas como eliminadas se omiten: su objeto no existe.
   */
  select coalesce(
    array_agg(pr.payment_proof_path),
    array[]::text[]
  )
  into v_paths
  from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id
    and pr.payment_proof_deleted_at is null
    and nullif(trim(pr.payment_proof_path), '') is not null;

  select count(*)::integer
  into v_tickets
  from public.tickets t
  where t.raffle_id = p_raffle_id;

  select count(*)::integer
  into v_requests
  from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id;

  -- Habilita el borrado del ganador solo para esta rifa y transacción.
  perform set_config(
    'app.purging_raffle_id',
    p_raffle_id::text,
    true
  );

  delete from public.ticket_prints tp
  where tp.ticket_id in (
    select t.id
    from public.tickets t
    where t.raffle_id = p_raffle_id
  );

  delete from public.raffle_winners rw
  where rw.raffle_id = p_raffle_id;

  delete from public.tickets t
  where t.raffle_id = p_raffle_id;

  delete from public.purchase_requests pr
  where pr.raffle_id = p_raffle_id;

  delete from public.raffles r
  where r.id = p_raffle_id;

  perform set_config('app.purging_raffle_id', '', true);

  return query
  select
    v_raffle.name,
    v_raffle.status,
    v_raffle.image_path,
    v_paths,
    v_requests,
    v_tickets;
end;
$$;


-- ============================================================
-- PERMISOS
-- ============================================================

revoke all
on function public.delete_payment_proof(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.delete_raffle(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.delete_payment_proof(uuid, uuid)
to service_role;

grant execute
on function public.delete_raffle(uuid, uuid)
to service_role;

comment on function public.delete_payment_proof(uuid, uuid)
  is 'Marca el comprobante de una solicitud como eliminado y devuelve su ruta en Storage para que el backend borre el objeto. Idempotente.';

comment on function public.delete_raffle(uuid, uuid)
  is 'DESTRUCTIVO: elimina una rifa y todo lo que cuelga de ella (solicitudes, tickets, impresiones, ganador) y devuelve las rutas de Storage a limpiar.';
