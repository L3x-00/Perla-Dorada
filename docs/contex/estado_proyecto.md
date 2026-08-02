PD-CC-01 · Estado actual del proyecto

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · **Reescrito el 2 ago 2026** tras una auditoría técnica completa del código, migraciones y base remota reales (el documento anterior describía el estado al 22-23 jul 2026 y quedó muy por detrás de lo construido después).

## 1. Propósito de este archivo

Evitar que Claude Code reconstruya funcionalidades existentes, modifique reglas críticas sin autorización o introduzca arquitecturas incompatibles. Léelo antes de tocar cualquier archivo. Los otros tres documentos de `docs/contex/` complementan este: `pendiente.md` (qué falta y reglas de negocio), `arquitectura.md` (convenciones y prompt maestro), `errores.md` (bitácora de bugs y decisiones).

## 2. Qué es el proyecto hoy

Ya no es solo "un sistema de rifas": es la **web de marca de la joyería**, con el sorteo como sección que aparece y desaparece según haya o no una rifa activa (se hacen 3-4 rifas al año; el resto del tiempo el sitio funciona como vitrina de joyería, sección "Nosotros", vitrina de piezas, promociones). Rediseño visual "lujo sobrio" (negro profundo + oro envejecido) aplicado el 23 jul 2026 y extendido desde entonces. El panel administrativo comparte paleta pero con densidad de herramienta (menos aire, sin animaciones lentas).

**Desplegado en producción en Render** (no Vercel): https://perla-dorada.onrender.com — Web Service + 2 Render Cron Jobs. La decisión de quedarse en Render es firme; migrar a Vercel no requeriría reestructurar nada, es solo costo/plan (ver `alcancefree.md`).

## 3. Stack tecnológico confirmado (versiones exactas de `package.json`, 2 ago 2026)

| Capa | Tecnología | Versión / detalle |
|---|---|---|
| Framework web | Next.js App Router | `^16.2.12` |
| Interfaz | React | `^19.2.8` |
| Lenguaje | TypeScript | `^5`, `strict: true` |
| Estilos | Tailwind CSS | `^4` — sin `tailwind.config.js`; vía `@tailwindcss/postcss` + `globals.css` (tokens `@theme`) |
| Animación (sitio) | `motion` (ex framer-motion) | `^12.42.2` |
| Animación (stage rig) | `gsap` + `@gsap/react` | `^3.15.0` / `^2.1.2` |
| Base de datos | Supabase PostgreSQL | Fuente de verdad, RPC, transacciones · `@supabase/supabase-js ^2.110.9` · `@supabase/ssr ^0.12.3` |
| Autenticación | Supabase Auth | 3 cuentas admin activas (ver §7) |
| Archivos | Supabase Storage | Bucket privado `payment-proofs` (comprobantes) + bucket público `raffle-images` (fotos de premio, premios de la lista y promociones, en subcarpetas) |
| Eventos | Supabase Realtime | Canal de **broadcast puro** para avisar a la portada de cambios en rifas (ver §8); sigue siendo solo informativo, nunca autoritativo |
| Hosting | **Render** | Web Service + 2 Cron Jobs (no Vercel) |
| Validación | Zod | `^4.4.3` (NO v3 — API de errores/inferencia difiere) |
| Procesamiento de imagen (servidor) | `sharp` (pin `0.35.3`) + `file-type` | Reencoda a WebP, sniffing real de tipo, elimina metadatos |
| Rutas protegidas | `src/proxy.ts` | Convención Next 16 (reemplaza `middleware.ts`) |

Overrides forzados en `package.json` (`postcss@8.5.23`, `sharp@0.35.3`) para cerrar CVEs transitivos de Next — ver DEP-01 en `errores.md`.

## 4. Principios arquitectónicos no negociables

- Monolito modular — no crear microservicios ni carpetas paralelas (`api-v2`, `services2`, `dashboard-new`).
- PostgreSQL es la fuente de verdad — estado, precio, disponibilidad, vencimiento, numeración de tickets, ganador.
- Backend soberano — el navegador nunca dicta precio, estado, expiración, ticket numbers ni total.
- Operaciones críticas son atómicas — vía RPC `SECURITY DEFINER` con `search_path` fijo.
- Realtime es informativo — quien recibe una señal siempre vuelve a consultar el servidor, nunca confía en el payload.
- Comprobantes privados — nunca URLs públicas permanentes; firmadas de vida corta.
- Ganador manual, único por premio, irreversible — nunca automatizar la selección.
- No agregar dependencias externas sin justificación explícita.

## 5. Patrón de seguridad (DEC-03, sin cambios): sin RLS clásico

Ninguna tabla tiene `CREATE POLICY`. El patrón es: `REVOKE ALL` de `anon`/`authenticated` en cada tabla + acceso exclusivo vía funciones `SECURITY DEFINER` (con `search_path = ''`) otorgadas solo a `service_role`, que **únicamente** se usa en servidor (`src/lib/supabase/admin.ts`, con `import "server-only"`). Es el diseño aceptado del proyecto (ver DEC-03 en `errores.md`), no una carencia — no añadir políticas RLS "por completitud".

Dos matices que se consolidaron con las features nuevas:
- No toda escritura necesita un RPC: las tablas de **contenido no crítico** (`app_settings`, `promotions`) se administran con CRUD directo desde las rutas admin usando `createAdminClient()`, con `requireActiveAdmin()` como guardia — mismo nivel de protección, sin la sobrecarga de un RPC cuando no hay invariantes multi-tabla que proteger.
- Las operaciones con invariantes reales (numeración de tickets, aprobación, ganador, ciclo de vida de tickets) sí siguen siendo RPC `SECURITY DEFINER`.

## 6. Estructura de carpetas real (verificada por inspección directa, 2 ago 2026)

`src/components/` **sí existe** hoy — corrige la nota de versiones anteriores de este documento y de `arquitectura.md`. El patrón real es híbrido:

```
src/
├── proxy.ts                          ← Next 16 middleware (auth admin, gate por pathname)
├── app/
│   ├── layout.tsx, globals.css
│   ├── page.tsx                      ← portada pública (Hero, RaffleSection|WinnerShowcase|NoRaffle, Showcase, About) + PromoCarouselModal (lazy)
│   ├── countdown.tsx                 ← cuenta regresiva de reserva, cliente
│   ├── admin/
│   │   ├── layout.tsx, page.tsx (dashboard solicitudes), admin-nav.tsx, login/page.tsx
│   │   ├── payment-proof-button.tsx, purchase-request-actions.tsx, ticket-print-action.tsx, ticket-reassign-action.tsx, delete-proof-button.tsx
│   │   ├── search/page.tsx
│   │   ├── settings/page.tsx, settings-form.tsx
│   │   ├── tickets/page.tsx, tickets/[id]/print/{page,print-controls}.tsx
│   │   ├── raffles/
│   │   │   ├── page.tsx, new/page.tsx, [id]/edit/page.tsx, [id]/winner/{page,winner-form}.tsx
│   │   │   ├── raffle-actions.tsx, raffle-form.tsx, raffle-image-upload.tsx, staged-image-input.tsx, prize-fields.tsx
│   │   └── promotions/
│   │       ├── page.tsx, new/page.tsx, [id]/edit/page.tsx
│   │       └── promotion-form.tsx, promotion-actions.tsx, staged-promo-image-input.tsx
│   ├── api/
│   │   ├── health/supabase/route.ts
│   │   ├── purchase-requests/route.ts, tracking/route.ts, tickets/route.ts
│   │   ├── cron/{expire-requests,retention}/route.ts
│   │   └── admin/
│   │       ├── settings/route.ts
│   │       ├── purchase-requests/[id]/{approve,reject,payment-proof}/route.ts
│   │       ├── raffles/route.ts, raffles/prize-image/route.ts, raffles/[id]/{route,delete,image,winner}.ts
│   │       ├── promotions/route.ts, promotions/image/route.ts, promotions/[id]/route.ts
│   │       └── tickets/[id]/{print,reassign}/route.ts
│   ├── seguimiento/
│   │   ├── page.tsx, tracking-form.tsx, layout.tsx
│   │   └── tickets/page.tsx, tickets-document.tsx
│   └── legal/
│       ├── layout.tsx, legal-document.tsx
│       └── terminos/, bases/, privacidad/, devoluciones/ (page.tsx cada una)
├── components/
│   ├── site/            ← portal público: Hero, SiteHeader, SiteFooter, RaffleSection, WinnerShowcase, WinnerCarousel,
│   │                        Participate, PurchaseWizard, PromoCarouselModal, PromoSlide, PromoIndicators, PromoNavigation,
│   │                        StageRig, RaffleCelebration, PrizeShowcase, Showcase, About, NoRaffle, Reveal, DrawCountdown,
│   │                        DocumentField, ProofUpload, Wordmark, BrandLogo, ThemeToggle, RealtimeRaffleWatcher, icons.tsx, etc.
│   └── admin/            ← kit compartido: ui.tsx (adminCard/Input/Label, btn*, AdminPage, Badge, EmptyState, AdminAlert), confirm-dialog.tsx
│                            (las páginas/formularios específicos de cada ruta admin siguen colocados junto a su ruta, NO están aquí)
├── config/
│   ├── app.ts, storage.ts, purchase.ts, brand.ts (redes/contacto/pago/legal, se oculta lo vacío), vitrina.ts (piezas de joyería)
├── lib/
│   ├── env.ts, format.ts, datetime-lima.ts, clipboard.ts, use-lock-body-scroll.ts
│   ├── audit/log.ts
│   ├── auth/admin.ts                 ← requireActiveAdmin() para rutas sin RPC
│   ├── raffles/{validation,errors,actions,prizes,public-raffle,public-winners}.ts
│   ├── promotions/{validation,public-promotions}.ts
│   ├── purchase-requests/errors.ts
│   ├── realtime/{channels,public-raffle-events}.ts
│   ├── security/{rate-limit,request-fingerprint,cron-auth,purchase-request-rate-limit}.ts
│   ├── storage/{images,payment-proofs,public-url}.ts
│   ├── images/compress-client.ts
│   ├── supabase/{admin,server,client,proxy}.ts
│   └── validation/{purchase-request,document,tracking}.ts
└── types/
    └── database.ts                   ← generado; 37 migraciones aplicadas al remoto, consistente
```

No hay `pages/`, no hay Edge Functions, no hay `seed.sql` con contenido real, no hay `pg_cron`. Cero carpetas paralelas ni duplicadas.

## 7. Tablas reales en `public` (11) + esquema `private` (1)

| Tabla | Para qué |
|---|---|
| `raffles` | Rifas: nombre, descripción, precio, total de tickets, fechas, `image_path` (premio mayor), `prizes` (jsonb, lista descriptiva de premios con `id` estable por elemento), `status` (draft\|active\|closed\|cancelled) |
| `purchase_requests` | Solicitudes de compra: datos del participante, cantidad, comprobante, `status` (pending\|approved\|rejected\|expired), `expires_at` |
| `tickets` | Tickets asignados: número correlativo por rifa, `ticket_status` (active\|frozen\|reassigned), `origin_ticket_id` (self-FK, traza una reasignación) |
| `ticket_prints` | Historial de impresiones/reimpresiones por ticket (límite `max_reprints`) |
| `raffle_winners` | Ganadores: `ticket_id` único globalmente, `prize_id`/`prize_title`/`prize_image_path` (nulo si la rifa no desglosa premios = "ganador de la rifa"), inmutable por triggers |
| `admin_profiles` | Quién es administrador activo (`user_id` de `auth.users` + `is_active`) |
| `app_settings` | Fila única (`id boolean`): `maintenance_mode`, `maintenance_message`, `reservation_minutes` (360 = 6h), `max_reprints` |
| `audit_log` | Append-only: `actor_user_id`, `action`, `entity`, `entity_id`, `metadata` jsonb |
| `participant_tracking_codes` | Código de seguimiento reusable por (`document_type`, `document_number`) — un código sirve para todas las compras de la misma persona |
| `participant_tracking_code_aliases` | Códigos históricos (de cuando el código era por-solicitud) mantenidos como alias hacia el código canónico |
| `promotions` | Promociones del carrusel de bienvenida: título, descripción, `image_path`, `cta_kind` (raffle\|url) + `cta_raffle_id`/`cta_url`, vigencia por fechas, `enabled` |
| `private.purchase_request_rate_limits` | Contadores de rate limit (ventana corta + diaria) por huella HMAC; se purga vía `purge_rate_limits` |

Enums: `raffle_status`, `purchase_request_status`, `ticket_lifecycle_status` (active\|frozen\|reassigned), `ticket_print_type` (original\|reprint), `participant_document_type` (dni\|cui), `promotion_cta_kind` (raffle\|url).

## 8. RPC reales (24, todas `SECURITY DEFINER`, `search_path=''`, grant solo a `service_role`)

Rifas: `create_raffle`, `update_raffle`, `activate_raffle`, `close_raffle`, `cancel_raffle`, `delete_raffle` (solo borrador vacío), `assign_prize_ids` (asigna id estable a cada premio del jsonb), `normalize_raffle_prizes` (validador puro).

Solicitudes/tickets: `create_purchase_request`, `approve_purchase_request`, `reject_purchase_request`, `expire_purchase_requests`, `register_ticket_print`, `reassign_frozen_ticket`.

Ganador: `register_raffle_winner(p_admin_user_id, p_raffle_id, p_ticket_number, p_prize_id default null)` — un ganador por premio (o uno solo si la rifa no desglosa premios).

Consulta pública: `get_public_ticket_document` (devuelve una fila **por ticket individual**, con `is_winner`/`prize_title`), `track_purchase_request`, `generate_tracking_code`, `normalize_document_number`, `normalize_tracking_code`. Cada una tiene firmas antiguas de 1-2 argumentos que quedan cerradas (error controlado) por compatibilidad de despliegue — la vigente es siempre la de más parámetros.

Auditoría/retención/límites: `delete_payment_proof`, `list_payment_proofs_for_retention`, `purge_rate_limits`, `check_rate_limit` (genérico, activo), `check_purchase_request_rate_limit` (legado, sin uso desde ERR-11), `assert_active_admin` (guardia interna, la llaman casi todas las anteriores).

**37 migraciones** aplicadas al remoto, cronológicas 2026-07-21 → 2026-08-02 (proyecto Supabase `iewcowhkfsywdiyligsq`). La secuencia completa está en `supabase/migrations/`; no hay huecos ni migraciones sin aplicar.

## 9. Componentes ya construidos — NO duplicar

Todo lo de Bloques A-G (portal público, configuración/mantenimiento, expiración, tickets/impresión, ganador, auditoría/retención, seguridad/endurecimiento) está **completo y desplegado**. Detalle histórico condensado en `pendiente.md` §2. Construido *después* de esa fase, en esta sesión y la inmediatamente anterior:

| Área | Estado |
|---|---|
| Rediseño de marca (portal + admin, "lujo sobrio") | ✅ — `src/config/brand.ts`/`vitrina.ts`, tipografías Cormorant Garamond + Inter, animación con `motion` |
| Ciclo de vida de tickets (`active/frozen/reassigned`) + reasignación trazable | ✅ — migración `20260727171136`, ver `arquitectura.md §2.1` |
| Seguimiento por código reusable por documento (no por solicitud) | ✅ — `participant_tracking_codes` + alias |
| Rifas con múltiples premios descriptivos (`raffles.prizes` jsonb) | ✅ — con foto opcional por premio |
| Realtime: portada se refresca sola al crear/activar/editar/cerrar/cancelar/eliminar una rifa | ✅ — broadcast puro, ver §10 |
| Ticket ganador destacado (dorado) en `/seguimiento/tickets`, con nombre del premio | ✅ |
| **Ganador por premio** (antes: uno solo por rifa) | ✅ — migración `20260802120000`, ver detalle abajo |
| **Ganadores mostrados públicamente** reemplazando la sección del sorteo cuando no hay rifa activa | ✅ — revierte DEC-04, nombre enmascarado (primer nombre + inicial del apellido) |
| **Modal de promociones** con carrusel, administrable desde `/admin/promotions` | ✅ — DB-backed, no config estática |
| Reserva de tickets: 60 min → **360 min (6h)** | ✅ |
| Modal "Participar" a pantalla completa por pasos, portal a `document.body` | ✅ (ver lección en `errores.md` sobre `AnimatePresence` + `createPortal`) |
| 3 cuentas administrativas activas en `admin_profiles` | ✅ |
| Pruebas finales + aceptación del cliente | ⚠️ Pendiente (ver `pendiente.md`) |

## 10. Patrón nuevo: broadcast de Realtime para refrescar la portada

`src/lib/realtime/channels.ts` define un único canal (`public:raffle-events`). `src/lib/realtime/public-raffle-events.ts` (server-only) lo usa para emitir un broadcast **sin datos de fila**, solo una señal, tras cada mutación de rifa en las rutas admin. `src/components/site/realtime-raffle-watcher.tsx` (client, montado en `page.tsx`) se suscribe con la clave publicable y llama `router.refresh()` al recibir la señal — nunca confía en el payload, siempre vuelve a consultar el servidor. Mismo principio de "Realtime es informativo" ya vigente en el proyecto, aplicado por primera vez en código.

## 11. Patrón nuevo: ganador por premio, compatible con lo existente

`raffles.prizes` es un jsonb array; cada elemento ahora tiene un `id` propio (asignado por `assign_prize_ids`, invocado desde `create_raffle`/`update_raffle`). `raffle_winners.prize_id` referencia ese id (no hay tabla de premios separada). Si la rifa **no** tiene premios desglosados (`prizes = '[]'`, el caso de todas las rifas reales hasta el 2 ago 2026), `prize_id` es `null` y significa "ganador de la rifa" — comportamiento idéntico al de antes. Constraint: índice único parcial `(raffle_id, prize_id) where prize_id is not null` + `(raffle_id) where prize_id is null` — nunca dos ganadores para el mismo premio, ni dos "generales" para la misma rifa. `raffle_winners.prize_title`/`prize_image_path` son una copia congelada del premio al momento de ganar (mismo criterio de inmutabilidad que el resto de la fila).

⚠️ **Los ganadores son inmutables incluso para `service_role`** (triggers `prevent_raffle_winner_changes` en UPDATE y DELETE, sin excepción de rol). Nunca insertar un ganador "de prueba" en el remoto sin que el usuario lo pida explícitamente — no hay forma de deshacerlo, y además se mostraría como ganador real en la portada pública hasta que cierre una rifa real nueva.

## 12. Riesgos conocidos / deuda técnica abierta

Ver `errores.md` para el detalle completo con estados. Resumen de lo 🟡 abierto al 2 ago 2026:
- `ERR-03` — sin scheduler nativo de expiración (mitigado por el Render Cron Job `/api/cron/expire-requests`, ~15 min).
- `ERR-07` — bajo, ya con reintento en colisión de tracking code (probabilidad extremadamente baja).
- `ERR-17` — semántica de cierre/cancelación con solicitudes pendientes, requiere decisión de negocio (no bug).
- La auditoría de entrega del 2 ago verificó y cerró ERR-18: health real de Supabase, tope de 30 tickets, comparación constante del cron, CSP defensiva, guardas de páginas admin y orden seguro al quitar imágenes. Ver `AUDITORIA_ENTREGA_2026-08-02.md`.

PD-CC-01 · Transferencia técnica Joyería Perla Dorada
