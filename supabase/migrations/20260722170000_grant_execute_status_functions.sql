-- ============================================================
-- ERR-05: GRANT EXECUTE explícito a service_role en las 3 funciones
-- SECURITY DEFINER que solo hacían REVOKE de public/anon/authenticated.
--
-- Empíricamente service_role ya podía ejecutarlas (privilegio implícito
-- de Supabase), pero el resto de funciones privilegiadas del proyecto
-- otorgan execute a service_role de forma explícita. Esta migración las
-- alinea y elimina la dependencia de ese comportamiento implícito.
-- Idempotente: re-otorgar no tiene efecto adverso.
-- ============================================================

grant execute
  on function public.approve_purchase_request(uuid, uuid)
  to service_role;

grant execute
  on function public.reject_purchase_request(uuid, uuid, text)
  to service_role;

grant execute
  on function public.expire_purchase_requests()
  to service_role;
