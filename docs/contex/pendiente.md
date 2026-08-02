PD-CC-02 · Trabajo pendiente y reglas de negocio

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · **Reescrito el 2 ago 2026** (la versión anterior describía el 22-27 jul 2026; todos los bloques A-G ya estaban cerrados desde entonces y se construyó bastante más — ver §2 y §4-10).

## 1. Propósito de este archivo

Definir qué falta genuinamente y las reglas de negocio invariantes. No usarlo para reconstruir lo ya existente — para eso está `estado_proyecto.md`.

## 2. Historial de bloques — todos 🟢 completados y desplegados

| Bloque | Contenido | Cerrado |
|---|---|---|
| 0 | Bug de ruteo admin approve/reject/payment-proof (`/api/admin/...` vs `/admin/...`) | 22 jul 2026 |
| A | Portal público de venta unitaria (landing, contador, formulario, confirmación) | 22 jul 2026 |
| B | Configuración/mantenimiento (`/admin/settings`, enforcement 503, `audit_log`) | 22 jul 2026 |
| C | Expiración: cron `/api/cron/expire-requests` + countdown en vivo | 22 jul 2026 |
| D | PDF/impresión: HTML print-to-PDF (DEC-02), descarga pública por DNI+código | 22 jul 2026 |
| E | Ganador irreversible (registro único por rifa en su momento) | 22 jul 2026 |
| F | Auditoría (`recordAuditEvent` en todas las rutas críticas) + retención de comprobantes (15 días) | 23 jul 2026 |
| G | Endurecimiento: rate limit en consultas públicas, cabeceras CSP, Zod compartido | 23 jul 2026 |
| Fase 7 | Despliegue y batería crítica (PF-01…PR-01) contra producción | 23 jul 2026, en **Render** |

Detalle técnico de cada uno (archivos, migraciones, verificación E2E) sigue disponible en el historial de git de este documento si hace falta reconstruir el razonamiento; no se repite aquí para no enterrar lo que sí está pendiente.

## 3. Trabajo construido después de la Fase 7 (no estaba en la versión anterior de este documento)

### 3.1 Rediseño de marca (23 jul 2026)

El sitio pasó de landing funcional a **web de marca de joyería** con el sorteo como sección intercambiable. Paleta "lujo sobrio" (negro + oro) en `globals.css` (`@theme`), tipografías Cormorant Garamond/Inter vía `next/font`, animación con `motion`. Todo lo no configurado en `src/config/brand.ts`/`vitrina.ts` se oculta solo (sin enlaces rotos ni secciones vacías). Panel admin: mismo lenguaje visual pero con densidad de herramienta (kit compartido en `src/components/admin/ui.tsx`).

### 3.2 Ciclo de vida de tickets + seguimiento por código reusable (27 jul 2026, migración `20260727171136` + `20260727222740`)

- `tickets.ticket_status`: `active | frozen | reassigned`. Cancelar una rifa congela sus tickets (`frozen`): no imprimibles, no elegibles como ganador. `reassign_frozen_ticket` (admin, rifa destino activa) crea un ticket nuevo `active` correlativo con `origin_ticket_id` apuntando al original, que pasa a `reassigned` (historial, nunca se mueve ni reutiliza).
- Límite de 30 tickets por solicitud (UI, Zod y Postgres).
- `participant_tracking_codes`: el código de seguimiento identifica al **participante** (documento), no a cada solicitud — reutilizable entre compras. `participant_tracking_code_aliases` conserva los códigos históricos de cuando era por-solicitud.
- Seguimiento y documento público exigen DNI + código de seguimiento (nunca DNI aislado).

### 3.3 Rifas con múltiples premios descriptivos (24 jul 2026, migración `20260724120000`; ampliado 2 ago 2026)

`raffles.prizes` (jsonb): lista de `{ id, title, quantity, image_path }`. `quantity` describe el premio ("una moto", "2× dinero en efectivo") y no multiplica ganadores: cada fila admite **un** ganador. Si habrá varios ganadores del mismo concepto, se crean filas separadas. La lista se valida con `normalize_raffle_prizes` y recibe un `id` con `assign_prize_ids` (`create_raffle`/`update_raffle`).

### 3.4 Realtime en la portada (1 ago 2026)

Crear, activar, editar, cerrar, cancelar o eliminar una rifa emite un broadcast (`public:raffle-events`, sin datos de fila) que la portada escucha y responde con `router.refresh()`. Antes el visitante necesitaba recargar a mano para ver un cambio de rifa. Detalle del patrón en `arquitectura.md`.

### 3.5 Modal de promociones administrable (1-2 ago 2026, migración `20260801120000`)

Modal de bienvenida con carrusel (3-4 slides), se abre a los 2s en cada carga si hay al menos una promoción vigente. Gestionado íntegramente desde `/admin/promotions`: título, descripción, foto (sube y comprime igual que las fotos de rifa, mismo bucket público `raffle-images`), texto y destino del botón (a la sección del sorteo, eligiendo de qué rifa se trata a modo de referencia, o a un enlace propio interno/externo), vigencia por fechas, activar/desactivar. El CTA cierra el modal antes de redirigir. Reemplazó una config estática (`src/config/promotions.ts`) que ya no existe.

### 3.6 Ganador por premio + mostrado públicamente (2 ago 2026, migración `20260802120000` + `20260802120100`)

- `register_raffle_winner` acepta `p_prize_id` (obligatorio si la rifa tiene premios desglosados, prohibido si no). Antes: un ganador por rifa, punto. Ahora: un ganador por cada premio de la lista (o uno solo si la rifa no desglosa premios — compatibilidad total con lo ya registrado).
- `/admin/raffles/[id]/winner`: una tarjeta de registro por premio si la rifa los tiene, o el formulario único de siempre si no.
- **DEC-04 resuelta (revertida a favor de mostrar)**: la última rifa cerrada con ganador(es) reemplaza la sección del sorteo en la portada mientras no haya una rifa activa, con navegación entre premios. El nombre se enmascara a "Primer nombre + inicial del apellido" — nunca el nombre completo ni el DNI en público.
- `get_public_ticket_document` ahora devuelve una fila por ticket individual (antes agrupaba varios tickets en un array por solicitud) para poder marcar `is_winner`/`prize_title` por ticket. Un ticket ganador se ve dorado con el nombre del premio en `/seguimiento/tickets`.
- Reserva de tickets: `reservation_minutes` 60 → **360** (6 horas).

## 4. Reglas de negocio invariantes (actualizado)

| Entidad | Estados / regla |
|---|---|
| Rifa | `draft → active → closed`; cancelación permitida desde draft o active. Solo una activa a la vez. Al cancelar, los tickets emitidos se congelan (`frozen`). |
| Solicitud | `pending → approved \| rejected \| expired`. Estados terminales no se revierten. |
| Ticket | Se asigna tras aprobación, correlativo por rifa, nunca reutilizable. `frozen → reassigned` (original) + nuevo `active` (destino) solo por reasignación explícita del admin. |
| Ganador | No registrado → registrado, **por premio** (o uno solo si la rifa no desglosa premios). Inmutable, incluso para `service_role`. Mostrado públicamente con nombre enmascarado. |
| Promoción | `enabled` + rango de fechas opcional determina si aparece en el carrusel de bienvenida. No tiene estados de flujo, es contenido de marketing editable en cualquier momento. |
| Comprobante | Privado; elegible para eliminación 15 días después del cierre de la rifa. |

Reglas operativas vigentes:
- Hasta **10 solicitudes pendientes** por documento y rifa; el tope se aplica de forma transaccional en PostgreSQL.
- Reserva de **360 minutos (6 horas)**, `reservation_minutes` en `app_settings`, configurable.
- Máximo 30 tickets por solicitud.
- Pago por Yape con validación manual del administrador.
- Comprobante JPG/PNG/WEBP, entrada máxima 5 MB, objeto final máximo 600 KiB/2000px (comprobantes) o 350 KiB/1920px (imágenes públicas); navegador y servidor reencodan antes de Storage.
- Aprobación y asignación de tickets atómicas.
- Máximo de reimpresiones configurable (actual: 5).
- Ganador manual, único por fila de premio, irreversible. La cantidad del premio es descriptiva; no crea ganadores adicionales.
- Consulta pública por DNI + código de seguimiento (ambos obligatorios; el código identifica al participante, es reusable entre compras).
- 3 cuentas administrativas activas.
- `ticket_price × requestedQuantity` calculado en backend; nunca confiar en el total del cliente.
- Un ticket congelado nunca se imprime, gana ni se reutiliza; solo se reasigna a un ticket nuevo trazable.

## 5. Trabajo genuinamente pendiente

- **Aceptación del cliente** sobre lo desplegado en producción.
- **Rotar `SUPABASE_SERVICE_ROLE_KEY` y `RATE_LIMIT_SECRET`** — quedaron expuestas en logs de Render por un incidente de configuración (ERR-10, ya corregido en código; la rotación de claves sigue pendiente del usuario).
- Confirmar que los **2 Render Cron Jobs** (`/api/cron/expire-requests` ~15min, `/api/cron/retention` diario) están activos con `CRON_SECRET` configurado en Render.
- Revisión legal de las páginas `/legal/*` (marcadas como borrador, `LEGAL_ES_BORRADOR = true` en `src/app/legal/legal-document.tsx`).
- Completar assets del cliente: `src/config/brand.ts` (redes, contacto, Yape, datos legales) y `src/config/vitrina.ts` (fotos de piezas de joyería) — todo lo vacío ya se oculta solo, no bloquea el despliegue.
- Decisión de negocio sobre el texto/estado que verá una solicitud pendiente cuando una rifa se cierre o cancele, y sobre si el cierre debe ejecutarse automáticamente en `closes_at` (ERR-17).
- Habilitar la protección de contraseñas filtradas de Supabase Auth desde el Dashboard (hallazgo de seguridad de la auditoría de entrega).
- Decisión de negocio (no técnica): si/cuándo pasar Supabase a plan Pro — ver `alcancefree.md`.

## 6. Definición global de terminado

- [x] `npx tsc --noEmit --pretty false` sin errores
- [x] `npm run lint` sin errores
- [x] `npm run build` sin errores
- [x] Migraciones reproducibles, aplicadas al remoto en orden
- [x] `src/types/database.ts` actualizado
- [x] Flujo completo: público → aprobación → tickets → consulta → ganador → operativo en producción
- [x] Producción pasa smoke tests (Fase 7, 23 jul 2026)
- [ ] Cliente acepta formalmente
- [ ] Claves rotadas (ERR-10)
- [ ] Revisión legal de `/legal/*`

PD-CC-02 · Transferencia técnica Joyería Perla Dorada
