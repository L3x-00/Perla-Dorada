PD-CC-04 · Bitácora de errores y deuda técnica conocida

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · Última actualización: 2 ago 2026 (ganador por premio, promociones administrables, realtime de portada)

1. Propósito de este archivo

Registro vivo de bugs y deuda técnica confirmados por lectura directa de código (no suposiciones). Actualizar este archivo cada vez que se descubra o se corrija un problema. Antes de reportar algo como "arreglado", verificar el fix (tsc/lint/build/prueba manual) y solo entonces cambiar el estado.

Estados: 🔴 abierto (bloqueante) · 🟡 abierto (no bloqueante) · 🟢 corregido · ⚪ decisión pendiente (no es bug)

## Actualización — 1-2 ago 2026 (ver ERR-19 a ERR-21, DEC-04 a DEC-06)

- Todo lo de la "Actualización de auditoría — 27 jul 2026" de abajo está **desplegado y verificado en producción** desde el 23 jul 2026 (Fase 7); la advertencia de "no marcar como verificado hasta desplegar" ya no aplica.
- **DEC-04 resuelta** (antes ⚪ pendiente): el ganador ahora SÍ se muestra públicamente, con nombre enmascarado. Ver detalle en DEC-04 más abajo.
- La nota de "DATOS DE PRUEBA A LIMPIAR" (rifa "ZZZ TEST GANADOR") quedó obsoleta: la base se limpió por completo (wipe total solicitado por el usuario) antes de que existieran datos reales de producción; hoy `raffles`/`tickets`/`raffle_winners` contienen únicamente actividad real del cliente. Se retira la sección.
- Nuevos hallazgos y decisiones de esta sesión: ERR-19, ERR-20, ERR-21, DEC-05, DEC-06.

## Actualización de auditoría — 27 jul 2026 (pendiente de despliegue)

- **ERR-17 — 🟢 Corregido en migración local:** cancelar una rifa congela los tickets emitidos; se bloquean impresión y ganador, y la reasignación administrativa a una rifa activa crea un ticket nuevo trazable. La semántica acordada está documentada en `auditoria_2026-07-27.md`.
- **ERR-18 — 🟢 Corregidos los ítems confirmados:** health verifica una tabla real de Supabase y no expone detalle; cantidad máxima de compra 30 en UI/Zod/BD; crons usan comparación en tiempo constante; CSP valida origen; las rutas/páginas admin exigen perfil activo; la eliminación de rifa queda limitada a borrador vacío.
- **PRIV-01 — 🟢 Corregido en migración local:** DNI aislado exponía solicitudes, nombres y tickets. Seguimiento y documento público requieren DNI + tracking code; las firmas heredadas quedan cerradas durante el despliegue.
- **IMG-01 — 🟢 Corregido local:** la compresión dejó de ser "mejor esfuerzo" que persistía originales. Cliente y servidor reencodan antes de Storage; el servidor es el fallback para Canvas no disponible.
- **DEP-01 — 🟢 Corregido para dependencias de producción:** Next/React/Supabase se actualizaron y se fuerzan `postcss@8.5.23` y `sharp@0.35.3`. `npm audit --omit=dev` devuelve 0 vulnerabilidades. El `npm audit` completo conserva vulnerabilidades de herramientas de lint que solo se resuelven con cambios mayores de ESLint y no alcanzan producción.

No marcar estas correcciones como verificadas en producción hasta aplicar `20260727171136_harden_ticket_lifecycle_and_purchase_limits.sql`, regenerar tipos y completar la lista de pruebas de `auditoria_2026-07-27.md`.

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

ERR-09 — 🟢 Resuelto (23 jul 2026) — admin_profiles vacío → aprobación/rechazo inoperantes
- Sembrado el 23 jul 2026 con el único usuario real de Auth: `ronla.angarita31@gmail.com` (user_id baf9ff81-419f-44e5-aa8a-72e92c7c50f0, display_name "ronla.angarita31", is_active=true). Verificado: approve_purchase_request ya NO responde "no es un administrador activo".
- ⚠️ Los documentos mencionan 2 cuentas administrativas, pero en Auth solo existe 1. Si se crea la segunda, hay que insertar también su fila en admin_profiles (mismo procedimiento) o no podrá aprobar/rechazar/imprimir.
- Detalle original abajo.
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

ERR-10 — 🟢 Corregido (código) / ⚠️ requiere rotación de claves — Variables de entorno pegadas en un mismo campo filtraban el secreto en logs
- Área: `src/lib/supabase/admin.ts` (y demás lectores de env), incidente en el despliegue de Render el 23 jul 2026.
- Causa: en el panel de Render se pegaron DOS variables en el campo de `SUPABASE_SERVICE_ROLE_KEY` (la clave + salto de línea + `RATE_LIMIT_SECRET=...`). Un salto de línea es inválido en un valor de cabecera HTTP, así que supabase-js fallaba con `TypeError: Headers.set: "<valor>" is an invalid header value` en TODA consulta. Peor: la excepción incluía el valor completo, por lo que **la service role key quedó impresa en los logs de Render**.
- Fix aplicado 23 jul 2026: helper `readRequiredEnv` en `src/lib/env.ts` que recorta, valida ausencia de espacios/saltos de línea y lanza un mensaje claro que NUNCA incluye el valor. Usado en admin.ts, server.ts, proxy.ts y request-fingerprint.ts; `client.ts` mantiene acceso estático (requisito de Next para NEXT_PUBLIC_* en el bundle) con `.trim()`.
- Verificado: con la variable malformada, el log muestra el mensaje explicativo y 0 apariciones del secreto; la landing degrada con "No pudimos cargar la rifa".
- ⚠️ ACCIÓN PENDIENTE DEL USUARIO: rotar `SUPABASE_SERVICE_ROLE_KEY` y `RATE_LIMIT_SECRET` (quedaron expuestas en logs), y actualizarlas en Render y `.env.local`.

ERR-11 — 🟢 Corregido — Rate limit eludible rotando el User-Agent
- Área: `src/lib/security/request-fingerprint.ts`, `rate-limit.ts`
- Causa: la huella era HMAC(IP + User-Agent). El User-Agent lo controla el cliente, así que rotándolo desde la misma IP se obtenía un cubo de conteo nuevo cada vez y el límite quedaba anulado. Confirmado en producción durante Fase 7: tras recibir 429 con un UA, bastó cambiarlo para volver a pasar.
- Fix aplicado 23 jul 2026: se evalúan DOS cubos por petición — el de IP+User-Agent (tope estricto) y uno nuevo de IP sola (tope más alto). Basta que uno se exceda para bloquear. El cubo de IP sola corta la rotación sin castigar a usuarios legítimos que comparten IP (NAT, operadores móviles). Topes: alta de solicitudes 5/15min y 20/día por IP+UA, 15/15min y 60/día por IP; consultas públicas 20/100 por IP+UA, 60/300 por IP.
- Verificado: con User-Agent distinto en cada petición, las 15 primeras pasan y desde la 16ª devuelve 429 (antes pasaban todas).
- Nota: `check_purchase_request_rate_limit` (RPC con topes fijos en SQL) queda sin uso; el código emplea ahora el RPC genérico `check_rate_limit`.
- Detectado y corregido: 23 jul 2026, durante Fase 7.

ERR-07 — 🟢 Corregido (23 jul 2026) — tracking_code sin retry en colisión de unicidad
- Resuelto al acortar el código: `generate_tracking_code()` (migración `20260723191000`) genera 8 caracteres Crockford Base32 dentro de un bucle que reintenta hasta 12 veces ante colisión con el índice único, y lanza `TRACKING_CODE_GENERATION_FAILED` (55000) si no lo logra. Verificado contra la BD real (devuelve p. ej. `XE5EYG0Q`).

ERR-12 — 🟢 Corregido — Rate limit eludible falsificando la IP (x-forwarded-for)
- Área: `src/lib/security/request-fingerprint.ts`
- Causa: `getClientIp()` leía `x-vercel-forwarded-for` (que en Render es puro input del cliente) con máxima prioridad, y de `x-forwarded-for` tomaba el elemento MÁS A LA IZQUIERDA (`split(",")[0]`), que es el que el cliente inyecta —los proxies añaden por la derecha—. Como esa IP es la única entrada de ambas huellas (IP+UA e IP sola), rotando la cabecera se abría un cubo nuevo por petición y el rate limit (incluida la defensa de ERR-11) quedaba anulado por completo: fuerza bruta ilimitada sobre DNI+código y alta ilimitada de solicitudes. Además permitía DoS dirigido: fijando la IP+UA de una víctima se le agotaba la cuota.
- Fix aplicado 23 jul 2026: se elimina `x-vercel-forwarded-for`; de `x-forwarded-for` se toma la IP a N posiciones desde la DERECHA (las que añade la infraestructura de confianza), configurable con `TRUSTED_PROXY_HOPS` (por defecto 1, correcto para Render servido directo); se valida con `node:net isIP` y, sin IP verificable, todo cae a un único cubo `unknown` (fail-closed). Detectado por la auditoría paralela del 23 jul 2026 (hallazgo confirmado).
- ⚠️ Si se pone un CDN (Cloudflare) por delante o se migra a Vercel, subir `TRUSTED_PROXY_HOPS` al número real de saltos, o el límite vuelve a ser eludible / agruparía a todos bajo la IP del CDN.

ERR-13 — 🟢 Corregido — Editar una rifa desplazaba sus fechas (zona horaria)
- Área: `src/app/admin/raffles/[id]/edit/page.tsx`, `raffle-form.tsx`
- Causa: `toDateTimeLocal()` corría en un Server Component (proceso de Render en UTC) y usaba `getTimezoneOffset()` del servidor, inyectando la hora UTC en el `<input datetime-local>`; al guardar, el navegador la reinterpretaba con su zona (Lima, UTC-5). Cada edición desplazaba starts/closes/draw +5 h de forma silenciosa (los CHECK de orden se mantenían).
- Fix aplicado 23 jul 2026: util compartido `src/lib/datetime-lima.ts` que ancla lectura (`isoToLimaInput`) y escritura (`limaInputToIso`) a America/Lima con `Intl`, sin restar horas a mano. `src/lib/format.ts` también fija `timeZone: America/Lima` para que Server y Client Components muestren la misma hora (evita desajustes de hidratación). Detectado por la auditoría paralela (hallazgo confirmado).

ERR-14 — 🟢 Corregido — La tabla de rate limiting nunca se purgaba (fuga de disco)
- Área: `private.purchase_request_rate_limits`, `check_rate_limit`
- Causa: cada petición inserta 2 filas por huella (ventana de 15 min + diaria) que nunca se borraban. Crecimiento monótono permanente; combinado con ERR-12 era un primitivo de inserción anónima ilimitada capaz de llenar el disco de la instancia y dejar la base en solo-lectura.
- Fix aplicado 23 jul 2026: `public.purge_rate_limits(p_retention_days=2)` (migración `20260723193000`, SECURITY DEFINER, solo service_role) borra ventanas vencidas usando el índice sobre `updated_at`; se invoca desde el cron diario de retención (`/api/cron/retention`). Detectado por la auditoría paralela (hallazgo confirmado).

ERR-15 — 🟢 Corregido — Rutas admin sin verificar admin_profiles (solo sesión)
- Área: `src/app/api/admin/settings/route.ts`, `.../purchase-requests/[id]/payment-proof/route.ts` (GET), `.../raffles/[id]/image/route.ts`
- Causa: estas rutas tocan tablas/Storage con service_role SIN pasar por un RPC que llame a `assert_active_admin`, y solo comprobaban que hubiera sesión (`getClaims().sub`). Equiparaba "tener cuenta en Auth" con "ser administrador". Hoy no es explotable porque los únicos usuarios de Auth son administradores y no hay registro público, pero si Supabase tuviera el registro abierto, cualquiera leería comprobantes del bucket privado, escribiría `app_settings` o sobrescribiría la foto del premio.
- Fix aplicado 23 jul 2026: helper `src/lib/auth/admin.ts` → `requireActiveAdmin()` (verifica sesión Y pertenencia a `admin_profiles` con is_active=true), cableado en esas rutas. Las demás operaciones admin ya estaban protegidas dentro del RPC (`assert_active_admin`). Detectado por la auditoría paralela.
- Nota (deuda menor, 🟡): las PÁGINAS admin de solo lectura (`src/app/admin/**`) siguen mostrando PII tras comprobar solo sesión; mismo argumento de "solo admins tienen Auth". El proxy tampoco distingue admin de usuario autenticado. Defensa en profundidad pendiente: mover la verificación a un punto único (layout o middleware con un RPC booleano concedido a authenticated). Prioridad baja mientras no exista registro público.

ERR-16 — 🟢 Corregido — Aprobar/Rechazar convertían todo conflicto en 500 (mapeo por idioma)
- Área: `src/app/api/admin/purchase-requests/[id]/{approve,reject}/route.ts`
- Causa: clasificaban el error buscando palabras en INGLÉS ("pending", "not found", "insufficient"…) en el mensaje, pero `approve_purchase_request` y `reject_purchase_request` lanzan sus mensajes en ESPAÑOL con `errcode` correctos. Ninguna coincidía, así que reserva vencida, solicitud ya revisada o inexistente devolvían un 500 genérico y el admin no sabía la causa.
- Fix aplicado 23 jul 2026: `src/lib/purchase-requests/errors.ts` mapea por `error.code` (P0002→404, P0001→409, 42501→403, 22023→400), propagando el mensaje de negocio del RPC. Detectado por la auditoría paralela.

ERR-17 — 🟡 Medio — Semántica de cierre/cancelación de rifa con solicitudes y tickets
- Área: `close_raffle`, `cancel_raffle` (migración `20260722151255`)
- Hallazgos de la auditoría paralela (SIN corregir; requieren decisión de negocio, no son fallos de código):
  1. Cerrar o cancelar una rifa marca sus solicitudes `pending` —incluidas las ya pagadas y a la espera de revisión— como `expired`, indistinguible de un vencimiento por tiempo. El cliente que pagó ve "Expirada" sin explicación.
  2. Cancelar una rifa deja vivos los tickets ya asignados: siguen imprimibles en el panel y descargables públicamente por DNI+código, pese a que la rifa ya no existe como evento válido.
  3. `closes_at` es informativo: nada impide crear solicitudes tras esa fecha hasta que un admin cierra la rifa a mano (el cron de expiración solo vence reservas, no cierra rifas). 
- Recomendación: (1) un estado/`motivo` distinto para pendientes anuladas por cierre; (2) decidir si cancelar debe invalidar tickets; (3) si se quiere cierre automático por fecha, añadirlo al cron. Pendiente de definición del cliente.
- Detectado: 23 jul 2026, auditoría paralela.

ERR-18 — 🟡 Bajo — Deuda menor detectada por la auditoría paralela (sin verificación adversarial completa)
- La corrida de verificación se interrumpió por límite de sesión; estos hallazgos quedaron sin doble verificación. Revisar antes de actuar:
  - `src/app/api/health/supabase/route.ts`: al parecer no contacta realmente con Supabase (responde ok:true siempre) y expone detalle de error sin auth. Revisar.
  - `src/app/admin/raffles/[id]/winner/page.tsx`: ignora el error de sus consultas; si falla la lectura de `raffle_winners`, podría mostrar el formulario de registro de una rifa que ya tiene ganador. Revisar guardas.
  - `src/lib/validation/purchase-request.ts` / RPC: `requestedQuantity` no tiene cota superior propia (más allá de la disponibilidad). Una sola solicitud puede reservar todo el inventario restante. Evaluar un tope por solicitud.
  - `src/app/api/cron/*`: el Bearer `CRON_SECRET` se compara con `!==`, no en tiempo constante. Impacto práctico bajo (timing sobre red), pero se puede endurecer con `crypto.timingSafeEqual`.
  - `next.config.ts`: la CSP se arma desde `process.env` sin validar; una variable ausente/con espacios generaría una política que bloquea login o imágenes en silencio.
  - `src/app/api/admin/raffles/[id]/image/route.ts`: el DELETE borra el objeto de Storage antes de actualizar la fila y descarta el error de lectura de la rifa (reporta 404 ante fallo de BD). Orden y manejo mejorables.
- Detectado: 23 jul 2026, auditoría paralela (8 dimensiones, ~49 hallazgos brutos; 3 confirmados con doble verificación → ERR-12/13/14, el resto quedó sin verificar por límite de sesión y se trianguló a mano).

ERR-19 — 🟢 Corregido — El modal "Participar" dejó de abrir tras portarlo a document.body
- Área: `src/components/site/participate.tsx`
- Causa: al envolver el modal con `createPortal` para que fuera un overlay real de viewport completo, quedó anidado DENTRO de `AnimatePresence` (`<AnimatePresence>{createPortal(...)}</AnimatePresence>`). `AnimatePresence` filtra sus hijos con `React.isValidElement`, y un `ReactPortal` no lo es — lo descartaba en silencio, sin error ni warning, así que el botón "Participar" no abría nada.
- Fix aplicado: el portal ahora ENVUELVE a `AnimatePresence` completo, nunca al revés (`createPortal(<AnimatePresence>...</AnimatePresence>, document.body)`), gateado por un hook `useMounted` basado en `useSyncExternalStore` (no `useEffect`+`setState`, que dispara el warning de "cascading render" del linter de hooks). Documentado como patrón en `arquitectura.md` §2.5 para no repetirlo.
- Detectado y corregido: 1 ago 2026, reportado directamente por el usuario ("no me abre el formulario").

ERR-20 — 🟢 Corregido — Las luces del escenario (StageRig) se filtraban dentro del modal de participación
- Área: `src/components/site/participate.tsx`, `stage-rig.tsx`
- Causa: el modal (antes de portarlo) vivía anidado dentro de `<Reveal>`, un `motion.div` que anima la posición vertical. Framer Motion deja un `transform` residual en ese contenedor incluso en reposo, y cualquier `transform` en un ancestro se convierte en el "containing block" de sus descendientes `position:fixed` — el modal dejaba de cubrir la pantalla completa y quedaba recortado dentro de la sección del sorteo (`overflow-hidden`), mezclándose visualmente con las luces del escenario (`StageRig`/`RaffleCelebration`).
- Fix aplicado: mismo fix que ERR-19 (portal a `document.body`) resuelve ambos problemas a la vez — el modal ya no depende de qué transform tenga un ancestro.
- Detectado y corregido: 1 ago 2026.

ERR-21 — 🟡 Riesgo evitado, no llegó a producción — reconstrucción de `update_raffle` desde memoria casi revirtió una validación real
- Área: migración `20260802120000_multi_prize_winners.sql` (durante su redacción, antes de aplicar)
- Causa: al preparar el cambio de `update_raffle` para asignar id a los premios, se reescribió el cuerpo completo de la función de memoria en vez de leer su definición íntegra vigente. La reconstrucción omitió que el chequeo `TICKET_PRICE_LOCKED` aplica siempre que hay `purchase_requests` (no solo con la rifa `active`) y usó el `errcode` equivocado en `TOTAL_TICKETS_BELOW_ASSIGNED_MAX` (`55000` en vez de `22023`).
- Por qué no llegó a producción: se detectó comparando la reconstrucción contra el archivo fuente real (`20260724120000_raffle_prizes.sql`) antes de ejecutar `supabase db push`. Nunca se aplicó la versión incorrecta.
- Lección aplicada: `arquitectura.md` §2.5 — nunca reconstruir de memoria el cuerpo de un RPC que se va a modificar; siempre leer la definición completa vigente primero.
- Detectado y corregido: 2 ago 2026, autodetectado antes de aplicar.

3. Decisiones pendientes (no son bugs, requieren definición del cliente)

DEC-01 — ⚪ src/components/{public,admin}/ no existe
- `docs/contex/arquitectura.md` originalmente esperaba esta carpeta; el código real coloca cada componente junto a su ruta. Decidir: adoptar convención actual (recomendado, cero fricción) o migrar como refactor explícito.

DEC-02 — 🟢 Resuelta (22 jul 2026) — "PDF" de tickets es HTML print-to-PDF A4
- Decisión tomada en Bloque D: se mantiene HTML + window.print() (impresión del navegador a PDF), sin agregar librería PDF. Aplica tanto a la impresión admin como a la descarga pública (`/seguimiento/tickets`). Justificación: evitar dependencia pesada (puppeteer en serverless) para beneficio marginal. Reabrir solo si el cliente exige PDF generado en servidor.

DEC-03 — 🟢 Resuelta (23 jul 2026) — Sin RLS clásico: todo vía SECURITY DEFINER + REVOKE ALL
- Patrón intencional y consistente en todas las migraciones: cada tabla tiene RLS habilitado sin políticas + REVOKE ALL a anon/authenticated; el acceso ocurre solo por funciones SECURITY DEFINER (con search_path fijo) otorgadas a service_role, que únicamente se usa en servidor (`src/lib/supabase/admin.ts`, con `import "server-only"`). Auditado en Bloque G y documentado como el DISEÑO ACEPTADO del proyecto, no como una carencia. No añadir políticas RLS "por completitud" sin una razón concreta.

DEC-04 — 🟢 Resuelta (2 ago 2026) — Mostrar el ganador públicamente
- Antes: Bloque E registraba el ganador y lo mostraba solo en el panel admin. Decisión pedida explícitamente por el cliente el 2 ago 2026: mostrarlo en público.
- Implementado: la última rifa cerrada que tenga al menos un ganador registrado reemplaza la sección del sorteo en la portada mientras no haya una rifa activa (`src/lib/raffles/public-winners.ts` + `WinnerShowcase`/`WinnerCarousel`). El nombre se enmascara a "primer nombre + inicial del primer apellido" (`maskWinnerName`) — nunca el nombre completo ni el DNI. Un ticket ganador también se destaca (dorado + nombre del premio) al consultarlo en `/seguimiento/tickets`. Ver `estado_proyecto.md` §11.

DEC-05 — 🟢 Resuelta (1-2 ago 2026) — Promociones: config estática vs. tabla administrable
- El modal de promociones se construyó primero como config estática (`src/config/promotions.ts`, siguiendo el patrón de `brand.ts`/`vitrina.ts`). El cliente pidió después poder subir fotos y gestionar promociones desde el panel sin tocar código.
- Decisión: se reemplazó por una tabla (`public.promotions`) administrada en `/admin/promotions`, con CRUD directo (no RPC — es contenido de marketing sin invariantes críticas, mismo criterio que `app_settings`). El archivo de config estática se eliminó.

DEC-06 — 🟢 Resuelta (2 ago 2026) — Un ticket no puede ganar más de un premio en la misma rifa
- Al diseñar "ganador por premio", se preguntó explícitamente si el mismo ticket podía repetirse como ganador de varios premios en una misma rifa (podría ocurrir en un sorteo físico real). El cliente eligió que no: cada premio debe tener un ticket ganador distinto.
- Implementado vía el índice único ya existente `raffle_winners_ticket_unique` (sobre `ticket_id`, sin cambios) — un ticket solo puede aparecer una vez en toda la tabla, lo que automáticamente también impide que gane dos veces dentro de la misma rifa.

4. Cómo usar este archivo
- Antes de tocar código: revisar si el área ya tiene un ERR-xx conocido.
- Al corregir un bug: cambiar su estado a 🟢, añadir fecha y referencia al commit/migración que lo resolvió.
- Al encontrar uno nuevo: añadir entrada con mismo formato (Área / Causa / Fix propuesto / Detectado).

PD-CC-04 · Bitácora técnica Joyería Perla Dorada
