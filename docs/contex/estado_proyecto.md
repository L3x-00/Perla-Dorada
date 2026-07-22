PD-CC-01 · Estado actual del proyecto

Sistema Web de Gestión de Rifas — Joyería Perla Dorada Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · 22 jul 2026 · Actualizado tras auditoría técnica real del código el 22 jul 2026

1. Propósito de este archivo

Evitar que Claude Code reconstruya funcionalidades existentes, modifique reglas críticas sin autorización o introduzca arquitecturas incompatibles. Lee este archivo antes de tocar cualquier archivo del repositorio.

1.1 Hallazgos críticos de la auditoría — leer antes de continuar

Estos hechos fueron verificados leyendo código y migraciones reales (no documentación previa). Corrigen afirmaciones anteriores de este mismo archivo.

- 🔴 BUG BLOQUEANTE — Aprobar/Rechazar/Ver comprobante en el panel admin devuelven 404. Los componentes cliente (`purchase-request-actions.tsx`, `payment-proof-button.tsx`) hacen fetch a `/api/admin/purchase-requests/{id}/approve|reject|payment-proof`, pero los route handlers reales viven en `src/app/admin/purchase-requests/[id]/approve|reject|payment-proof/route.ts` (sin prefijo `/api`). No existe reescritura de ruta. La lógica de backend y el RPC están completos y correctos; solo falta reconciliar la ruta cliente↔servidor. Es el primer arreglo recomendado antes de cualquier trabajo nuevo.
- 🟢 (RESUELTO 22 jul 2026) `create_purchase_request` ahora lee `app_settings.reservation_minutes` (ERR-02) y además se corrigieron dos bugs runtime pre-existentes que rompían TODA creación de solicitud (ERR-08: ambigüedad `raffle_id` + `gen_random_bytes` sin esquema). Migraciones aplicadas al remoto; POST público verificado → 201. Ver errores.md.
- 🟡 `expire_purchase_requests()` existe como función pero no hay ningún disparador automático (sin `pg_cron`, sin trigger, sin cron de Vercel). Solo se invoca inline dentro de `create_purchase_request`, `close_raffle` y `cancel_raffle`, y solo sobre la rifa/DNI relevante en ese momento — nunca de forma global y periódica.
- 🟡 Archivo de proxy/middleware duplicado: existe `proxy.ts` en la raíz del repo Y `src/proxy.ts`, con matchers distintos (`/admin/:path*` + `/api/admin/:path*` vs. casi todas las rutas). Next.js solo reconoce uno; el otro es código muerto o fuente de comportamiento indefinido. Resolver antes de tocar autenticación/rutas.
- 🟡 No existe `src/components/` — todos los componentes cliente están junto a su ruta (ej. `raffle-form.tsx` al lado de `raffles/page.tsx`). La estructura de carpetas descrita en `arquitectura.md` §3 no coincide con el repo real; ver nota en ese archivo.
- 🟡 Zod instalado es v4 (`^4.4.3`), no v3. Las convenciones de manejo de errores/`z.infer` de v3 no aplican tal cual si se buscan ejemplos genéricos en línea.
- ℹ️ No existe ninguna política RLS (`CREATE POLICY`) en ninguna migración. El acceso está completamente cerrado por diseño: `REVOKE ALL` a `anon`/`authenticated` en cada tabla + funciones `SECURITY DEFINER` otorgadas solo a `service_role`. Es un patrón válido y consistente, pero significa que "RLS" como tal no está en uso — toda la seguridad de fila vive en las funciones. Tres funciones (`approve_purchase_request`, `reject_purchase_request`, `expire_purchase_requests`, migración 3) no tienen un `GRANT EXECUTE ... TO service_role` explícito, a diferencia de todas las funciones posteriores — verificar si esto es intencional.
- ℹ️ La tabla `raffle_winners` YA EXISTE en la base de datos (con constraints de unicidad e inmutabilidad vía triggers), pero no hay ningún RPC que inserte un ganador ni UI alguna que la use. Ver corrección en la sección 5.
- ℹ️ Rate limiting real cubre únicamente `POST /api/purchase-requests`. `/api/tracking` y todas las rutas `/admin` y `/api/admin/**` no tienen límite de tasa propio (aparte de los límites nativos de Supabase Auth en login).
- 🟡 (ERR-09, hallado 22 jul 2026) `admin_profiles` está VACÍA en el remoto → aprobar/rechazar solicitudes fallan siempre ("no es administrador activo") aunque el admin inicie sesión. Es setup de datos manual (sembrar admin_profiles con los user_id reales), no bug de código. Ver errores.md.
- ✅ (22 jul 2026) Bloques A, B y C completados y verificados E2E contra el remoto. Bloque C: cron de expiración `/api/cron/expire-requests` (Bearer CRON_SECRET) + countdown en vivo. Requiere `CRON_SECRET` en Vercel.

2. Corrección de alcance — CRÍTICO

Los documentos iniciales del proyecto mencionan paquetes. Esa decisión fue eliminada por el cliente.

❌ Eliminado	✅ Vigente
packages, raffle_packages, package_id	Precio unitario: ticket_price en la tabla raffles
Promociones por volumen	Contador de cantidad (requestedQuantity)
Precios alternativos	total = ticket_price × requestedQuantity (calculado en backend)

El navegador nunca es fuente confiable del precio ni del total.

3. Stack tecnológico confirmado (versiones exactas de package.json/node_modules)
Capa	Tecnología	Versión / Detalle
Framework web	Next.js App Router	16.2.10 (pinned)
Interfaz	React	19.2.4 (pinned)
Lenguaje	TypeScript	5.9.3, strict: true
Estilos	Tailwind CSS	v4.3.3 — sin tailwind.config.js; vía @tailwindcss/postcss + globals.css
Base de datos	Supabase PostgreSQL	Fuente de verdad, RPC, transacciones · @supabase/supabase-js 2.110.8 · @supabase/ssr 0.12.3
Autenticación	Supabase Auth	2 cuentas admin creadas manualmente
Archivos	Supabase Storage	Bucket privado `payment-proofs`, 5MB, jpg/png/webp
Eventos	Supabase Realtime	Solo informativo; nunca autoritativo (sin uso detectado aún en el código)
Hosting	Vercel	App Router, previews y producción
Validación	Zod	v4.4.3 (NO v3 — API de errores/inferencia difiere)
Rutas protegidas	`src/proxy.ts`	Convención Next 16 (reemplaza middleware.ts) — ⚠️ hay un `proxy.ts` duplicado en la raíz, ver 1.1
4. Principios arquitectónicos no negociables
Monolito modular — no crear microservicios
PostgreSQL es la fuente de verdad — estado, precio, disponibilidad, vencimiento, numeración
Backend soberano — el cliente no dicta precio, estado, expiración ni ticket numbers
Operaciones críticas son atómicas — via RPC/PostgreSQL
Realtime es informativo — siempre reconsultar después de un evento
Comprobantes privados — nunca URLs públicas permanentes
Mensajes públicos controlados — detalle técnico solo en logs
No agregar dependencias externas sin justificación explícita
5. Componentes ya construidos — NO duplicar
Área	Estado
Scaffold Next.js, TypeScript, Tailwind	✅ Completado
Clientes Supabase (browser / server / admin)	✅ Completado
Health endpoint	✅ Completado
Esquema DB inicial + tipos src/types/database.ts	✅ Completado
Autenticación administrativa (getClaims, protección de rutas)	✅ Completado
Carga de comprobantes (JPG/PNG/WEBP, máx 5 MB, bucket privado)	✅ Completado
POST /api/purchase-requests (multipart, Zod, rate limit, RPC, compensación)	✅ Backend completo
RPC create_purchase_request	✅ Completado
Reserva de 60 min (expires_at)	✅ Completado en dominio
Duplicidad por DNI (una solicitud pendiente por DNI + rifa)	✅ Completado
Dashboard administrativo de solicitudes	✅ Completado (lista, filtros, columnas)
Aprobación y rechazo de solicitudes	✅ Completado — bug de ruteo corregido 22 jul 2026 (ver errores.md ERR-01)
Asignación atómica de tickets (correlativos)	✅ Completado en RPC `approve_purchase_request`, alcanzable desde la UI tras el fix de ruteo
ticket_prints + RPC register_ticket_print (límite 5)	✅ Completado y alcanzable — única acción admin sin bug de ruteo confirmada
UI de impresión / reimpresión	✅ Admin: HTML + `window.print()` (registrado, límite max_reprints). Público (Bloque D, 22 jul): `/seguimiento/tickets` — documento A4 imprimible validado por DNI+code para solicitudes aprobadas (RPC get_public_ticket_document + /api/tickets). Decisión DEC-02: HTML print-to-PDF, sin librería. Verificado E2E
Seguimiento público por DNI + tracking code	✅ Completado — RPC `track_purchase_request`, ruta `/seguimiento` y `/api/tracking` verificados end-to-end
Búsqueda administrativa por DNI y número de ticket	✅ Completado
CRUD de rifas (/admin/raffles) + activar / cerrar / cancelar	✅ Completado — rutas cliente/servidor consistentes, sin bug de ruteo
RLS / acceso privado	ℹ️ Sin políticas RLS en ninguna tabla; acceso cerrado por REVOKE ALL + SECURITY DEFINER (patrón intencional). Verificar GRANT faltante en 3 funciones de migración 3 (ver 1.1)
Página pública principal	✅ Completado 22 jul 2026 (Bloque A) — landing de venta unitaria: rifa activa, contador −/+, total visual, formulario multipart a POST /api/purchase-requests, confirmación con trackingCode. Verificado contra BD real. Archivos: `src/app/page.tsx`, `src/app/purchase-form.tsx`, `src/lib/raffles/public-raffle.ts`, `src/lib/format.ts`
Ganador	✅ Completado 22 jul 2026 (Bloque E) — RPC `register_raffle_winner` + ruta `/api/admin/raffles/[id]/winner` + UI con doble confirmación + vista de solo lectura. Inmutable (triggers). No expuesto públicamente. Verificado E2E
Configuración pública + mantenimiento	✅ Completado 22 jul 2026 (Bloque B) — pantalla `/admin/settings` (mantenimiento, mensaje configurable, minutos de reserva, máx reimpresiones); enforcement 503 en POST y en landing; audit_log de cambios. Migraciones aplicadas al remoto y verificado E2E. Además se corrigió ERR-08 (create_purchase_request estaba roto: ambigüedad + gen_random_bytes) — el flujo de solicitud pública ahora funciona (POST → 201 verificado)
Retención automática de comprobantes	❌ Pendiente — columna `payment_proof_deleted_at` existe pero ninguna función/job la usa
Pruebas finales + despliegue producción	❌ Pendiente
6. Árbol de archivos confirmados (re-verificado por inspección directa, 22 jul 2026)
src/
├── proxy.ts                                    ← Next 16 middleware; ⚠️ DUPLICADO con proxy.ts en raíz del repo, ver 1.1
├── app/
│   ├── layout.tsx, globals.css, favicon.ico
│   ├── page.tsx                                ← CONFIRMADO placeholder (26 líneas); pendiente reemplazar
│   ├── admin/
│   │   ├── layout.tsx, page.tsx (dashboard solicitudes)
│   │   ├── login/page.tsx
│   │   ├── payment-proof-button.tsx, purchase-request-actions.tsx, ticket-print-action.tsx   ← client components
│   │   ├── purchase-requests/[id]/approve/route.ts     ← ⚠️ URL real: /admin/purchase-requests/{id}/approve (SIN /api)
│   │   ├── purchase-requests/[id]/reject/route.ts      ← ⚠️ ídem
│   │   ├── purchase-requests/[id]/payment-proof/route.ts ← ⚠️ ídem
│   │   ├── search/page.tsx
│   │   ├── tickets/page.tsx, tickets/[id]/print/page.tsx, tickets/[id]/print/print-controls.tsx
│   │   └── raffles/
│   │       ├── page.tsx, new/page.tsx, [id]/edit/page.tsx
│   │       ├── raffle-actions.tsx
│   │       └── raffle-form.tsx
│   ├── api/
│   │   ├── health/supabase/route.ts
│   │   ├── purchase-requests/route.ts
│   │   ├── tracking/route.ts
│   │   └── admin/
│   │       ├── raffles/route.ts, raffles/[id]/route.ts
│   │       └── tickets/[id]/print/route.ts     ← esta sí coincide con el fetch del cliente (sin bug)
│   └── seguimiento/
│       ├── page.tsx
│       └── tracking-form.tsx
├── config/
│   ├── app.ts
│   └── storage.ts
├── lib/
│   ├── env.ts
│   ├── raffles/
│   │   ├── validation.ts, errors.ts, actions.ts
│   ├── security/
│   │   ├── request-fingerprint.ts, purchase-request-rate-limit.ts
│   ├── storage/
│   │   └── payment-proofs.ts
│   ├── supabase/
│   │   ├── admin.ts, server.ts, client.ts, proxy.ts
│   └── validation/
│       └── purchase-request.ts
└── types/
    └── database.ts                             ← generado, verificado consistente con las 10 migraciones actuales

⚠️ NO existe src/components/ — todos los componentes cliente están junto a su ruta. Corrige la expectativa de arquitectura.md §3.

supabase/
├── config.toml
└── migrations/ (10 archivos, cronológicos 2026-07-21 → 2026-07-22)
    20260721163904_initial_raffle_schema.sql
    20260721164313_add_purchase_approval_function.sql
    20260721164609_add_request_status_functions.sql
    20260721165638_create_payment_proofs_bucket.sql
    20260721171031_create_public_purchase_request_function.sql
    20260721171407_grant_server_purchase_request_access.sql
    20260721172435_add_purchase_request_rate_limiting.sql
    20260721193615_register_ticket_print.sql
    20260721201744_purchase_request_tracking.sql
    20260722151255_raffle_admin_functions.sql

No hay supabase/functions/ (Edge Functions), no hay seed.sql pese a que config.toml lo referencia, no hay pg_cron.

Antes de crear cualquier archivo: inspecciona el árbol real del repositorio. Esta lista es la confirmada por lectura directa de código.

7. API POST /api/purchase-requests — comportamiento confirmado (código leído completo)
Acepta exclusivamente multipart/form-data
Rechaza body superior a 6MB antes de parsear (Content-Length)
Aplica rate limiting antes de procesar archivos (RPC check_purchase_request_rate_limit: 5/15min, 20/día por fingerprint IP+UA)
Valida fullName, dni, phone, whatsapp, requestedQuantity con Zod (src/lib/validation/purchase-request.ts)
Exige paymentProof; valida tipo real (sniffing con `file-type`, no solo extensión) y tamaño ≤5MB
Consulta la rifa activa en backend (nunca confía en raffleId del cliente)
Sube comprobante a Storage privado (bucket payment-proofs)
Invoca create_purchase_request con datos normalizados
Elimina el archivo si la operación de BD falla (compensación, con warning no-fatal si el cleanup también falla)
Devuelve { ok: true, data: { requestId, trackingCode, expiresAt } } ← nota: envuelto en "data", no plano como se documentó antes
Mapea errores de unicidad (23505), datos inválidos (22023), rifa inexistente (P0002) y disponibilidad insuficiente (P0001) a mensajes públicos en español
⚠️ expiresAt siempre es now()+60min fijo — reservation_minutes de app_settings no se usa (ver 1.1)
8. Riesgos conocidos de transferencia
Riesgo	Control
Documentos anteriores hablan de paquetes	Aplicar corrección de alcance en TODO código nuevo (grep confirmó cero residuos en src/)
Posible duplicación de módulos	Inspeccionar árbol, rutas, RPC y migraciones antes de crear
Tipos Supabase pueden diferir	Regenerar database.ts tras cada migración (verificado consistente hoy)
Uso excesivo de service role	Solo en servidor; nunca al cliente (confirmado: solo en src/lib/supabase/admin.ts y consumidores server-only)
Realtime tratado como autoridad	Siempre reconsultar tras eventos (sin uso de Realtime detectado aún en el código)
Expiración solo visual	La BD debe validar expires_at en operaciones críticas; falta scheduler para expire_purchase_requests()
Total calculado en navegador	Aceptar quantity; calcular total en backend
Bug de ruteo admin approve/reject/payment-proof	Corregir antes de cualquier feature nueva — ver 1.1
reservation_minutes no conectado al RPC	Actualizar create_purchase_request para leer app_settings antes de asumir que el toggle de Bloque B funcionará
Proxy/middleware duplicado (raíz + src/)	Eliminar uno, confirmar cuál Next.js realmente usa, antes de tocar auth/rutas

PD-CC-01 · Transferencia técnica Joyería Perla Dorada