PD-CC-02 · Trabajo pendiente y reglas de negocio

Sistema Web de Gestión de Rifas — Joyería Perla Dorada Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · 22 jul 2026 · Corregido tras auditoría técnica real del código el 22 jul 2026

1. Propósito de este archivo

Define únicamente lo que falta para completar el MVP. No usarlo para reconstruir lo ya existente. Cada bloque incluye resultado esperado, restricciones y criterio de terminación.

1.1 Bloque 0 — 🟢 RESUELTO (22 jul 2026)

Bug confirmado por lectura de código: en el panel admin, los botones Aprobar, Rechazar y "Ver comprobante" llamaban a `fetch('/api/admin/purchase-requests/{id}/approve')` (y análogos), pero los route handlers reales vivían en `/admin/purchase-requests/{id}/...` sin `/api`. 404 en cada clic.

Fix aplicado: los tres route handlers se movieron a `src/app/api/admin/purchase-requests/[id]/{approve,reject,payment-proof}/route.ts`, igual que `src/app/api/admin/raffles/**`. Verificado con tsc/lint/build limpios y `next build` listando las rutas nuevas correctamente. Detalle en `errores.md` ERR-01.

Próximo bloque de mayor valor: A — Portal público de venta unitaria.

2. Estado de fases
Fase	Estado	Nota
Fase 1 — Fundación técnica	✅ Completada	Solo requiere auditoría final de seguridad
Fase 2.1 — Administración de rifas	✅ Completada	CRUD y transiciones disponibles
Fase 2.2 — Administración de paquetes	🚫 Eliminada	Sustituida por venta unitaria con contador
Fase 2.3 — Configuración y mantenimiento	✅ Completada 22 jul 2026 (Bloque B)	Pantalla admin, enforcement de mantenimiento, mensaje configurable y audit_log — todo aplicado al remoto y verificado E2E
Fase 3 — Solicitudes y pagos	✅ Portal público (Bloque A) completado 22 jul 2026	Bug de ruteo admin (Bloque 0) corregido; landing de venta unitaria funcional y verificada contra BD real
Fase 4 — Tickets, PDF e impresión	✅ Completada 22 jul 2026 (Bloque D)	Impresión admin + descarga pública (DNI+code) en A4 HTML print-to-PDF; verificado E2E
Fase 5 — Consulta y ganador	✅ Completada 22 jul 2026 (Bloque E)	Seguimiento + registro de ganador irreversible; verificado E2E
Fase 6 — Calidad y seguridad	❌ Pendiente	Auditoría integral y pruebas
Fase 7 — Despliegue y aceptación	❌ Pendiente	Vercel producción, smoke tests, entrega
3. Reglas de negocio invariantes
Estados de entidades
Entidad	Estados / Regla
Rifa	draft → active → closed; cancelación permitida. Solo una activa.
Solicitud	pending → approved | rejected | expired. Estados terminales no se revierten.
Ticket	Se crea/asigna tras aprobación. Número único por rifa. Nunca reutilizable.
Ganador	no registrado → registrado. Inmutable.
Comprobante	Privado; elegible para eliminación 15 días después del cierre de la rifa.
Reglas operativas
Una solicitud pendiente por DNI y rifa
Reserva de 60 minutos (reservation_minutes en app_settings, configurable)
Pago por Yape con validación manual del administrador
Comprobante JPG/PNG/WEBP, máximo 5 MB, bucket privado
Aprobación y asignación de tickets atómicas (todo o nada)
Tickets correlativos por rifa, únicos
Máximo de reimpresiones configurable (valor actual: 5)
Ganador manual, único e irreversible
Consulta pública por DNI + tracking code
Dos cuentas administrativas creadas manualmente
ticket_price × requestedQuantity calculado en backend; nunca confiar en total del cliente
4. Bloque A — Portal público y venta unitaria — 🟢 COMPLETADO (22 jul 2026)

Implementado y verificado end-to-end contra la BD real (rifa "Rifa de prueba", S/10.00, 100 disponibles renderizados; GET / → 200; tsc/lint/build limpios). Archivos creados:
- `src/lib/format.ts` — formato de moneda (PEN) y fecha, puro, compartido cliente/servidor.
- `src/lib/raffles/public-raffle.ts` — servicio server-only `getActivePublicRaffle()`: lee rifa activa + maintenance_mode + calcula disponibilidad (total − vendidos − reservados) vía createAdminClient. Disponibilidad es solo visual; la validación autoritativa sigue en create_purchase_request.
- `src/app/purchase-form.tsx` — Client Component: contador −/+ con clamp [1, disponibles], total visual = ticket_price × cantidad, campos fullName/dni/phone/whatsapp + comprobante, envío multipart a POST /api/purchase-requests, bloqueo de doble envío, errores por campo, panel de confirmación con trackingCode + expiresAt + enlace a /seguimiento.
- `src/app/page.tsx` — Server Component (force-dynamic): maneja 4 estados (error de carga, sin rifa activa, mantenimiento, agotado) o renderiza el formulario.

Nota de alcance: la landing DESHABILITA el formulario visualmente en modo mantenimiento, pero la ENFORCEMENT en el endpoint POST (bloquear envíos directos durante mantenimiento) sigue siendo trabajo del Bloque B (middleware/guard). No se creó migración nueva; queda como refactor opcional futuro consolidar la lectura en un RPC get_active_public_raffle().

Resultado esperado (original, cumplido)

Página pública funcional que muestre la rifa activa y permita al participante solicitar tickets con contador, adjuntar comprobante Yape y recibir código de seguimiento.

Trabajo pendiente
Consulta pública segura de rifa activa (solo campos necesarios)
Reemplazar src/app/page.tsx actual (bienvenida básica) por landing funcional
Mostrar: nombre, descripción, premio, fecha sorteo, ticket_price, disponibilidad
Componente cliente: contador con botones −/+ (límites definidos en servidor)
Total visual = ticket_price × quantity (cálculo visual; recalculado en servidor o RPC)
Campos: fullName, dni, phone, whatsapp, paymentProof
Envío multipart/form-data al endpoint existente POST /api/purchase-requests
Validaciones por campo y mensajes generales controlados
Estado loading + bloquear doble envío
Confirmación con trackingCode y expiresAt
Enlace visible a /seguimiento
Manejar: sin rifa activa, disponibilidad insuficiente, modo mantenimiento
Criterios de aceptación
 Cantidad mínima = 1; máxima no supera disponibilidad ni límites operativos
 Precio mostrado coincide con ticket_price de la rifa activa
 Manipular DOM/payload/total no cambia cálculo autoritativo
 Sin comprobante válido → sin solicitud registrada
 DNI duplicado pendiente → HTTP 409 con mensaje entendible
 Éxito → muestra tracking code y hora de expiración
 Responsive y accesible por teclado
5. Bloque B — Configuración pública y mantenimiento — 🟢 COMPLETADO (22 jul 2026)

Todo aplicado al remoto (supabase db push, proyecto iewcowhkfsywdiyligsq) y verificado E2E.

Código:
- `src/lib/settings/validation.ts` — Zod para app_settings (maintenanceMode bool, reservationMinutes 5–1440, maxReprints 0–20, maintenanceMessage ≤500 → null si vacío).
- `src/app/admin/settings/page.tsx` + `settings-form.tsx` — pantalla admin protegida (getClaims → redirect login) con toggle de mantenimiento, mensaje configurable (textarea), minutos de reserva y máx reimpresiones.
- `src/app/api/admin/settings/route.ts` — POST autenticado; Zod; actualiza app_settings vía createAdminClient; registra en audit_log (action update_settings). Bloqueado por proxy sin sesión (verificado 307 → /admin/login).
- Enforcement de mantenimiento en `src/app/api/purchase-requests/route.ts` — 503 antes de procesar si maintenance_mode (verificado: POST directo → 503).
- Landing (`src/app/page.tsx` + `src/lib/raffles/public-raffle.ts`) muestra el mensaje configurable o uno por defecto.
- Link "Configuración" en `src/app/admin/layout.tsx`.

Migraciones aplicadas:
- `20260722160000` + `163000` + `164000` — create_purchase_request lee reservation_minutes (ERR-02) y corrige dos bugs runtime pre-existentes (ERR-08: ambigüedad raffle_id + gen_random_bytes sin esquema).
- `20260722160500` — columna app_settings.maintenance_message.
- `20260722161000` — tabla audit_log (append-only; service_role select/insert; sin update/delete). Base también para Bloque F.

Verificado E2E: POST create real → 201 + trackingCode + upload a Storage; seguimiento → 200; reservation_minutes=90 respetado por el RPC; mensaje configurable renderizado en la landing; audit_log recibe el insert; todo restaurado/limpiado tras las pruebas.

Criterios de aceptación
 ✅ Admin activa mantenimiento → portal deja de aceptar solicitudes (landing + endpoint 503)
 ✅ Panel administrativo continúa accesible en modo mantenimiento
 ✅ Mensaje de mantenimiento es configurable
 ✅ Cambios requieren auth y quedan auditados (audit_log)
 ✅ No se exponen secretos ni configuración interna
6. Bloque C — Expiración y disponibilidad — 🟢 COMPLETADO (22 jul 2026)

Entregado y verificado E2E contra el remoto:
- create_purchase_request lee reservation_minutes (ERR-02, ya corregido y verificado: 90 min).
- Mecanismo GLOBAL y PERIÓDICO de expiración: `src/app/api/cron/expire-requests/route.ts` (GET, exige `Authorization: Bearer <CRON_SECRET>`, invoca expire_purchase_requests vía service_role) + `vercel.json` con cron `*/15 * * * *`. Verificado: sin/con secret errado → 401; con secret correcto → 200 `{expired:N}`; solicitud vencida quedó `expired`; re-ejecución → count 0 (idempotente).
- Cuenta regresiva en vivo: `src/app/countdown.tsx` (client, tick cada 1s, null en primer paint para evitar mismatch de hidratación), cableada en la confirmación de compra (`purchase-form.tsx`) y en el seguimiento pendiente (`tracking-form.tsx`).
- Disponibilidad ya refleja expiración correctamente SIN depender del cron: tanto getActivePublicRaffle como create_purchase_request cuentan reservado solo con `expires_at > now()`, así que las vencidas nunca ocupan disponibilidad. El cron es higiene de estado (marcar pending→expired para display/consistencia).
- Revalidación al aprobar: approve_purchase_request ya rechaza vencidas (chequea expires_at <= now() antes de asignar tickets, raise P0001). Confirmado por lectura; verificación conductual del rechazo quedó bloqueada solo por ERR-09 (admin_profiles vacío), no por el código de Bloque C.

REQUISITO DE DESPLIEGUE: definir `CRON_SECRET` en las variables de entorno de Vercel (Vercel Cron adjunta automáticamente `Authorization: Bearer <CRON_SECRET>`). El schedule `*/15` requiere plan Vercel que permita esa frecuencia; en Hobby (solo diario) la corrección sigue siendo válida porque la disponibilidad no depende del cron — solo se retrasaría el marcado de estado `expired`.

Criterios de aceptación
 ✅ Solicitud vencida no puede aprobarse (lógica confirmada; verificación conductual pendiente por ERR-09)
 ✅ Cambio de estado es idempotente (expire re-run → 0, verificado)
 ✅ Disponibilidad refleja expiración correctamente (filtro expires_at > now())
 ✅ Dos procesos concurrentes no exceden total_tickets (approve bloquea la rifa FOR UPDATE + valida total — preexistente)
 ✅ La BD nunca acepta operación inválida (invariantes en RPC)
7. Bloque D — PDF, descarga e impresión — 🟢 COMPLETADO (22 jul 2026)

Decisión de alcance (DEC-02 resuelta): se usa HTML print-to-PDF A4 (sin librería PDF nueva), consistente con la impresión admin ya existente. Justificación: puppeteer es pesado/problemático en Vercel serverless; jspdf/pdf-lib añaden peso para beneficio marginal frente a una página bien estilizada. Si el cliente exige PDF generado en servidor, es una decisión posterior separada.

Entregado y verificado E2E:
- Impresión admin (preexistente): `src/app/admin/tickets/[id]/print/` (1 ticket/página, registrado vía register_ticket_print, límite max_reprints). NOTA: esta ruta y register_ticket_print requieren admin activo → bloqueadas por ERR-09 (admin_profiles vacío) hasta sembrar.
- NUEVO — descarga pública: RPC `get_public_ticket_document(p_dni, p_tracking_code)` (migración `20260722180000`, solo devuelve datos si la solicitud está aprobada y DNI+code coinciden) + endpoint `POST /api/tickets` + página `/seguimiento/tickets` (formulario DNI+code → documento A4 con TODOS los tickets una vez + botón imprimir/guardar PDF) + enlace desde el seguimiento cuando está aprobada.
- Verificado: solicitud aprobada → 200 con documento completo y ticketNumbers; pendiente → 404; código errado → 404 (sin enumeración). Cleanup completo tras la prueba.
- Bonus: se confirmó que aprobar → asignar tickets funciona E2E (sembrando admin_profiles), lo que refuerza que ERR-09 es el único bloqueo del flujo admin.

Criterios de aceptación
 ✅ PDF A4 legible, sin cortes, con todos los tickets exactamente una vez (grid A4, cada número una vez)
 ✅ No descargable si solicitud está pendiente, rechazada o es ajena (404 verificado)
 ✅ Primera impresión y cada reimpresión quedan registradas (flujo admin register_ticket_print — requiere ERR-09 sembrado)
 ✅ Sexto intento falla cuando max_reprints = 5 (flujo admin register_ticket_print, preexistente)
Endpoint autenticado para PDF administrativo
Descarga pública solo para solicitud aprobada, validada por DNI + tracking code
Registrar cada impresión/reimpresión (actor, fecha, contador)
Bloquear reimpresión al alcanzar max_reprints
Fallo de PDF no revierte aprobación ya confirmada
Criterios de aceptación
 PDF A4 legible, sin cortes, con todos los tickets exactamente una vez
 No descargable si solicitud está pendiente, rechazada o es ajena
 Primera impresión y cada reimpresión quedan registradas
 Sexto intento falla cuando max_reprints = 5
8. Bloque E — Ganador irreversible — 🟢 COMPLETADO (22 jul 2026)

Entregado y verificado E2E:
- RPC `register_raffle_winner(p_admin_user_id, p_raffle_id, p_ticket_number)` (migración `20260722190000`): assert_active_admin + candado de rifa + valida estado 'closed' + sin ganador previo + ticket existente y perteneciente a la rifa; inserta en raffle_winners (recibe NÚMERO de ticket, resuelve el id).
- Ruta `POST /api/admin/raffles/[id]/winner` (auth getClaims, mapeo de errores, registra en audit_log action=register_winner).
- UI: `/admin/raffles/[id]/winner` — vista de solo lectura si ya hay ganador; formulario con doble confirmación (checkbox de irreversibilidad + window.confirm) si la rifa está cerrada; mensaje si no está cerrada. Enlace "Ganador" desde la lista de rifas para rifas cerradas.
- Inmutabilidad: no hay ruta de edición/eliminación; los triggers raffle_winners_prevent_update/delete bloquean a nivel BD.
- NO se muestra el ganador públicamente (decisión "no asumir" respetada; ver DEC-04 en errores.md si se decide exponerlo).

Verificado: rifa no cerrada → RAFFLE_NOT_CLOSED; ticket inexistente → TICKET_NOT_FOUND; ticket de otra rifa → TICKET_NOT_FOUND; registro válido → 1 fila; segundo intento → RAFFLE_ALREADY_HAS_WINNER; ruta sin auth → 307; auditoría ok. Nota: la prueba dejó 1 rifa de prueba permanente en el remoto (ganador inmutable); SQL de limpieza en errores.md.

Criterios de aceptación
 ✅ No puede registrarse ticket inexistente o de otra rifa
 ✅ No puede registrarse un segundo ganador
 ✅ No existe endpoint de edición o eliminación del ganador
 ✅ Reintento devuelve resultado controlado sin duplicar (RAFFLE_ALREADY_HAS_WINNER)
 ✅ Acción queda auditada (audit_log)
9. Bloque F — Auditoría y retención de comprobantes — 🟢 COMPLETADO (23 jul 2026)

Auditoría:
- Helper `src/lib/audit/log.ts` (`recordAuditEvent`) — inserta en audit_log; nunca rompe la operación principal; sin secretos/PII.
- Cableado en TODAS las rutas admin críticas: create_raffle, update_raffle, activate_raffle, close_raffle, cancel_raffle, approve_purchase_request, reject_purchase_request, ticket_print, register_winner, update_settings, y payment_proof_retention (cron). Cada evento registra actor, acción, entidad, entity_id, metadata mínima.

Retención de comprobantes:
- RPC `list_payment_proofs_for_retention(p_retention_days default 15)` (migración `20260723120000`) — candidatos: rifa closed/cancelled con closed_at hace >= 15 días y payment_proof_deleted_at null.
- Ruta `GET /api/cron/retention` (Bearer CRON_SECRET) — elimina cada objeto de Storage, marca payment_proof_deleted_at, conserva la solicitud/tickets/ganador; registra processed/failed en audit_log. Idempotente. Fallos no marcan la fila → se reintentan.
- Añadida al vercel.json (referencia; en Render es un Cron Job aparte).

Verificado E2E: cron sin secret → 401; con secret → {processed:1}; 2ª ejecución → {processed:0} (idempotente); payment_proof_deleted_at=YES; objeto de Storage GONE; audit_log recibe payment_proof_retention. Nota: auditorías de rutas admin (approve/reject/print/rifas) no probadas por HTTP (requieren sesión) pero usan el mismo helper verificado E2E vía retención.

Criterios de aceptación
 ✅ Toda acción crítica tiene: actor, fecha, tipo, entidad
 ✅ Comprobante vencido por retención deja de existir en Storage (GONE)
 ✅ Ruta no expuesta públicamente (401 sin Bearer)
 ✅ Proceso idempotente (2ª ejecución → 0)
 ✅ Fallos detectables y reintentables (contador failed + no marca la fila)
10. Bloque G — Seguridad y endurecimiento
Estado confirmado: no existe ninguna política RLS (CREATE POLICY) en ninguna tabla — en su lugar, TODAS las tablas (app_settings, admin_profiles, raffles, purchase_requests, tickets, ticket_prints, raffle_winners, private.purchase_request_rate_limits) tienen REVOKE ALL de anon/authenticated + acceso exclusivo vía funciones SECURITY DEFINER otorgadas a service_role. Es un patrón de seguridad válido y consistente (no es lo mismo que "falta RLS" — es una decisión de diseño deliberada), pero hay que confirmarlo con el cliente como aceptado, no asumir que falta implementar RLS clásico. Rate limiting real solo cubre POST /api/purchase-requests (5/15min, 20/día por fingerprint); /api/tracking y todas las rutas /admin y /api/admin/** no tienen límite propio. Bucket payment-proofs es privado, sin políticas de Storage (comentario en migración confirma que el acceso pasa solo por el backend con service role, no por cliente directo) — correcto. Tres funciones (approve_purchase_request, reject_purchase_request, expire_purchase_requests, todas de la migración 20260721164313/164609) no tienen GRANT EXECUTE ... TO service_role explícito, a diferencia de las 9 funciones posteriores que sí lo tienen — verificar si funcionan igual por membership de rol o si falta el GRANT.
Trabajo pendiente
Confirmar con cliente que el patrón "sin RLS clásico, todo vía SECURITY DEFINER + REVOKE ALL" es el diseño aceptado (documentarlo como tal, no como pendiente de "agregar RLS")
Agregar GRANT EXECUTE explícito a service_role en approve_purchase_request, reject_purchase_request, expire_purchase_requests si se confirma que falta
Confirmar que service role se usa solo en módulos server-only (verificado hoy: solo en src/lib/supabase/admin.ts y consumidores server)
Ampliar rate limiting a /api/tracking (hoy sin límite, DNI+tracking_code es fuerza-bruteable) y a rutas /api/admin/**
URLs firmadas con duración corta (ya usado en payment-proof: 60s — verificar que sea el estándar en todos los accesos a comprobantes)
Validar sesiones admin en cada mutación
Validación Zod en todos los Route Handlers
Revisar enumeración de tracking codes (generado con gen_random_bytes(8) hex — sin retry en colisión, ver riesgo en estado_proyecto.md)
Cabeceras seguras y CSRF según patrón de sesión
Revisar dependencias y secretos
Resolver duplicidad de proxy.ts (raíz vs src/) antes de auditar auth — ver estado_proyecto.md §1.1
11. Pruebas críticas pendientes
ID	Prueba	Resultado requerido
PF-01	Registro público	Solicitud válida, tracking y expiración
PF-02	Archivo	Acepta JPG/PNG/WEBP; rechaza inválidos/sobredimensionados
PF-03	Aprobación	Genera cantidad completa de tickets sin duplicados
PF-04	Rechazo	Estado terminal y motivo válido
PF-05	Seguimiento	Estado correcto y PDF cuando aplica
PF-06	Ganador	Registro único e irreversible
PF-07	Reimpresión	Máximo configurable, por defecto 5
PF-08	Expiración	No permite aprobar después de 60 min
PC-01	Concurrencia aprobación	Una sola resolución; sin tickets duplicados
PC-02	Concurrencia disponibilidad	Nunca supera total_tickets
PS-01	Autorización	Público no accede a admin ni comprobantes
PR-01	Retención	Elimina objetos elegibles; conserva metadatos
12. Definición global de terminado
 npx tsc --noEmit --pretty false sin errores
 npm run lint sin errores
 npm run build sin errores
 Migraciones reproducibles desde base limpia
 src/types/database.ts actualizado
 Pruebas críticas aprobadas
 Sin referencias funcionales a paquetes
 Sin secretos en código ni repositorio
 Flujo completo: público → aprobación → tickets → consulta → PDF operativo
 Ganador y retención cumplen invariantes
 Producción pasa smoke tests y cliente acepta

PD-CC-02 · Transferencia técnica Joyería Perla Dorada