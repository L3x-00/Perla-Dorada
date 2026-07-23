PD-CC-04 · Bitácora de errores y deuda técnica conocida

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · Última actualización: 22 jul 2026 (auditoría técnica inicial)

1. Propósito de este archivo

Registro vivo de bugs y deuda técnica confirmados por lectura directa de código (no suposiciones). Actualizar este archivo cada vez que se descubra o se corrija un problema. Antes de reportar algo como "arreglado", verificar el fix (tsc/lint/build/prueba manual) y solo entonces cambiar el estado.

Estados: 🔴 abierto (bloqueante) · 🟡 abierto (no bloqueante) · 🟢 corregido · ⚪ decisión pendiente (no es bug)

2. Bugs activos

ERR-01 — 🟢 Corregido — Aprobar/Rechazar/Ver comprobante devuelven 404 en admin
- Área: `src/app/admin/purchase-request-actions.tsx`, `payment-proof-button.tsx`
- Causa: hacen fetch a `/api/admin/purchase-requests/{id}/approve|reject|payment-proof`, pero los route handlers reales estaban en `src/app/admin/purchase-requests/[id]/{approve,reject,payment-proof}/route.ts` (sin prefijo `/api`).
- Fix aplicado: 22 jul 2026 — los 3 route handlers se movieron (git mv) a `src/app/api/admin/purchase-requests/[id]/{approve,reject,payment-proof}/route.ts`, mismo patrón que `src/app/api/admin/raffles/**` y `src/app/api/admin/tickets/[id]/print/route.ts`. Verificado: tsc, lint y build limpios; `next build` lista las 3 rutas nuevas bajo `/api/admin/purchase-requests/[id]/...`.
- Detectado: 22 jul 2026, auditoría de código. Corregido: 22 jul 2026.

ERR-02 — 🟢 Corregido — create_purchase_request ignoraba app_settings.reservation_minutes
- Área: función `create_purchase_request`
- Causa: `expires_at := now() + interval '60 minutes'` hardcodeado; nunca leía `app_settings.reservation_minutes`.
- Fix aplicado 22 jul 2026: migraciones `20260722160000` (+ correcciones posteriores `163000`, `164000`) que leen reservation_minutes de app_settings con respaldo 60 (make_interval). Aplicadas al remoto (supabase db push) y verificado end-to-end: con reservation_minutes=90, el RPC devolvió expires_at ≈ now()+90min.
- Detectado: 22 jul 2026. Corregido y verificado: 22 jul 2026.

ERR-08 — 🟢 Corregido — create_purchase_request estaba ROTO en tiempo de ejecución (bug pre-existente crítico)
- Área: función `create_purchase_request` (heredado del original, migración `20260721171031`)
- Causa: DOS fallos que hacían que TODA solicitud pública real fallara con 500 (nunca se pudo crear una solicitud por HTTP):
  1. `column reference "raffle_id" is ambiguous` — el UPDATE de expiración usaba columnas sin calificar (raffle_id, expires_at) que también son nombres de columnas de salida del RETURNS TABLE → PL/pgSQL (variable_conflict=error) aborta.
  2. `function gen_random_bytes(integer) does not exist` — con `search_path=''`, la llamada sin calificar a gen_random_bytes (pgcrypto en esquema `extensions`) no resuelve.
- Por qué no se detectó antes: los tests previos del endpoint solo cubrieron rechazos (415/400/rate-limit/mantenimiento), nunca un create exitoso. La doc afirmaba "POST backend completo" sin verificación de creación real.
- Fix aplicado 22 jul 2026: migración `20260722163000` (alias en el UPDATE) + `20260722164000` (extensions.gen_random_bytes). Aplicadas al remoto y verificado E2E por HTTP: POST /api/purchase-requests → 201 con trackingCode, upload real a Storage, seguimiento → 200; fila y objeto de Storage limpiados tras la prueba.
- Detectado y corregido: 22 jul 2026, durante verificación de Bloque B.

ERR-03 — 🟡 Alto — expire_purchase_requests() sin disparador automático
- Área: migración `20260721164609_add_request_status_functions.sql`
- Causa: la función existe y funciona, pero nada la invoca de forma global y periódica (sin pg_cron, sin trigger, sin cron de Vercel). Solo se llama inline y acotada a una rifa/DNI específica dentro de otras funciones.
- Fix propuesto: Vercel Cron (ruta `/api/cron/expire-requests` o similar, protegida) que invoque el RPC cada N minutos, o `pg_cron` si el plan de Supabase lo soporta.
- Detectado: 22 jul 2026, auditoría de código.

ERR-04 — 🟢 Corregido — proxy.ts duplicado (raíz del repo + src/proxy.ts)
- Área: `proxy.ts` (raíz) vs `src/proxy.ts`
- Causa: ambos definían `export async function proxy(request)` con matchers distintos. Next.js solo reconoce una ubicación canónica; el otro archivo era código muerto o fuente de comportamiento indefinido.
- Fix aplicado: 22 jul 2026 — eliminado `proxy.ts` de la raíz (`git rm`), se mantiene `src/proxy.ts` (matcher amplio; `updateSession()` ya gatea internamente por pathname, solo redirige en `/admin*` y `/api/admin*`, así que correr en todas las rutas es seguro y consistente con que el resto del proyecto vive bajo `src/`). Verificado: build muestra una sola línea "ƒ Proxy (Middleware)", sin ambigüedad.
- Detectado: 22 jul 2026, auditoría de código. Corregido: 22 jul 2026.

ERR-05 — 🟢 Corregido — 3 RPC sin GRANT EXECUTE explícito a service_role
- Área: `approve_purchase_request`, `reject_purchase_request`, `expire_purchase_requests` (migraciones 2 y 3)
- Causa: a diferencia de las demás funciones privilegiadas, estas 3 solo hacían REVOKE de public/anon/authenticated, sin `grant execute ... to service_role`.
- Verificado 22 jul 2026: empíricamente service_role YA podía ejecutarlas (expire → OK count=0; approve/reject → error de negocio 22023, no permission denied) por privilegio implícito de Supabase. No estaba roto, pero dependía de comportamiento implícito.
- Fix aplicado 22 jul 2026: migración `20260722170000_grant_execute_status_functions.sql` con los GRANT explícitos (aplicada al remoto). Elimina la dependencia del comportamiento implícito y alinea con el resto del proyecto.
- Detectado: 22 jul 2026. Corregido: 22 jul 2026.

ERR-09 — 🟡 Alto (setup de datos, no código) — admin_profiles vacío → aprobación/rechazo inoperantes
- Área: tabla `public.admin_profiles` en el remoto (proyecto iewcowhkfsywdiyligsq)
- Causa: la tabla tiene 0 filas. `approve_purchase_request` y `reject_purchase_request` exigen que el usuario exista en admin_profiles con is_active=true; con la tabla vacía, TODO intento de aprobar/rechazar falla con "El usuario no es un administrador activo" (42501), aunque el admin pueda iniciar sesión por Supabase Auth. Las migraciones crean la tabla pero no la siembran (por diseño: "2 cuentas admin creadas manualmente").
- Fix: paso de setup manual (no código). Por cada usuario admin de auth.users, insertar una fila en admin_profiles (user_id = id del usuario auth, display_name, is_active=true). Se puede hacer con service_role o desde el dashboard. Requiere conocer los user_id reales de los admins.
- Detectado: 22 jul 2026, durante verificación de Bloque C. NO se sembró automáticamente (no se deben inventar user_id).
- Nota (Bloque D, 22 jul): se verificó que al sembrar temporalmente admin_profiles con un user_id real de auth, approve_purchase_request funciona y asigna tickets correctamente; luego se eliminó la fila temporal. Confirma que sembrar admin_profiles es lo único que falta para habilitar aprobar/rechazar/imprimir en admin. También afecta register_ticket_print (impresión admin).

ERR-06 — 🟢 Corregido — Rate limiting solo cubría POST /api/purchase-requests
- Área: `src/lib/security/*`
- Causa: `/api/tracking` (y luego `/api/tickets`) validan solo con DNI + tracking_code y no tenían límite de tasa.
- Fix aplicado 23 jul 2026 (Bloque G): RPC genérico `check_rate_limit(fingerprint, short_limit, daily_limit)` (migración `20260723140000`) + `src/lib/security/rate-limit.ts`. Ambos endpoints comparten el ámbito `public-lookup` (20/15 min, 100/día); el ámbito se separa incluyendo `scope` en el HMAC, dejando intacta la cuota del alta de solicitudes. Verificado E2E: 20 OK, la 21ª → 429 con Retry-After; `/api/tickets` también 429 tras agotar vía `/api/tracking`.
- Nota: las rutas `/api/admin/**` no llevan rate limit por decisión: exigen sesión válida y están gateadas por el proxy (sin vector anónimo). Ver Bloque G en pendiente.md.
- Detectado: 22 jul 2026. Corregido: 23 jul 2026.

DEP-01 — ⚪ Riesgo aceptado — CVEs en dependencias transitivas de Next
- `npm audit` reporta sharp <0.35.0 (high, CVEs de libvips) y postcss (moderate, XSS en stringify de CSS), ambas arrastradas por `next`.
- No hay corrección disponible: Next 16.2.11 (última parche, ya aplicada) sigue empaquetando sharp 0.34.5, y `npm audit fix --force` propone next@9.3.3 (downgrade inviable).
- Impacto real nulo en esta app: `next/image` NO se usa (verificado: la única coincidencia textual es una regex del matcher en `src/proxy.ts`), por lo que sharp nunca procesa imágenes en runtime. Los comprobantes suben a Supabase Storage y se validan con sniffing de `file-type`, sin pasar por sharp. postcss actúa en build sobre CSS propio, no de usuario.
- Acción: revisar en futuras versiones de Next. Registrado 23 jul 2026.

ERR-07 — ⚪ Bajo — tracking_code sin retry en colisión de unicidad
- Área: función `create_purchase_request`, generación `upper(encode(gen_random_bytes(8),'hex'))`
- Causa: si hay colisión con el índice único `purchase_requests_tracking_code_idx`, la función falla con un error crudo de Postgres en vez de reintentar con otro código. Probabilidad extremadamente baja (16 hex chars) pero sin manejo.
- Fix propuesto: opcional — envolver en loop de reintento si se quiere robustez extra. Baja prioridad.
- Detectado: 22 jul 2026, auditoría de código.

3. Decisiones pendientes (no son bugs, requieren definición del cliente)

DEC-01 — ⚪ src/components/{public,admin}/ no existe
- `docs/contex/arquitectura.md` originalmente esperaba esta carpeta; el código real coloca cada componente junto a su ruta. Decidir: adoptar convención actual (recomendado, cero fricción) o migrar como refactor explícito.

DEC-02 — 🟢 Resuelta (22 jul 2026) — "PDF" de tickets es HTML print-to-PDF A4
- Decisión tomada en Bloque D: se mantiene HTML + window.print() (impresión del navegador a PDF), sin agregar librería PDF. Aplica tanto a la impresión admin como a la descarga pública (`/seguimiento/tickets`). Justificación: evitar dependencia pesada (puppeteer en serverless) para beneficio marginal. Reabrir solo si el cliente exige PDF generado en servidor.

DEC-03 — 🟢 Resuelta (23 jul 2026) — Sin RLS clásico: todo vía SECURITY DEFINER + REVOKE ALL
- Patrón intencional y consistente en todas las migraciones: cada tabla tiene RLS habilitado sin políticas + REVOKE ALL a anon/authenticated; el acceso ocurre solo por funciones SECURITY DEFINER (con search_path fijo) otorgadas a service_role, que únicamente se usa en servidor (`src/lib/supabase/admin.ts`, con `import "server-only"`). Auditado en Bloque G y documentado como el DISEÑO ACEPTADO del proyecto, no como una carencia. No añadir políticas RLS "por completitud" sin una razón concreta.

DEC-04 — ⚪ Mostrar el ganador públicamente — pendiente de decisión del cliente
- Bloque E registra el ganador y lo muestra solo en el panel admin (vista de solo lectura). El documento de alcance dice "definir si se muestra públicamente (no asumir)". No se expuso en el portal público. Si el cliente lo desea, agregar una vista pública (p. ej. en /seguimiento o la landing) leyendo raffle_winners de la rifa cerrada.

DATOS DE PRUEBA A LIMPIAR (remoto iewcowhkfsywdiyligsq) — dejados por la verificación de Bloque E
- Se creó una rifa de prueba cerrada ("ZZZ TEST GANADOR (borrar)") con 1 solicitud + 1 ticket + 1 ganador para verificar register_raffle_winner. El ganador es INMUTABLE (trigger), por lo que service_role no puede borrarlo. Para limpiar, ejecutar en el SQL editor de Supabase (como owner/postgres):
  alter table public.raffle_winners disable trigger raffle_winners_prevent_delete;
  delete from public.raffle_winners w using public.raffles r where w.raffle_id = r.id and r.name = 'ZZZ TEST GANADOR (borrar)';
  alter table public.raffle_winners enable trigger raffle_winners_prevent_delete;
  delete from public.tickets t using public.raffles r where t.raffle_id = r.id and r.name = 'ZZZ TEST GANADOR (borrar)';
  delete from public.purchase_requests pr using public.raffles r where pr.raffle_id = r.id and r.name = 'ZZZ TEST GANADOR (borrar)';
  delete from public.raffles where name = 'ZZZ TEST GANADOR (borrar)';
- No afecta el portal público (solo se muestra la rifa activa; esta es cerrada). Prioridad baja.

4. Cómo usar este archivo
- Antes de tocar código: revisar si el área ya tiene un ERR-xx conocido.
- Al corregir un bug: cambiar su estado a 🟢, añadir fecha y referencia al commit/migración que lo resolvió.
- Al encontrar uno nuevo: añadir entrada con mismo formato (Área / Causa / Fix propuesto / Detectado).

PD-CC-04 · Bitácora técnica Joyería Perla Dorada
