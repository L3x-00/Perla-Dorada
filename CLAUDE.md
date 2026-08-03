# Perla Dorada Rifas — contexto persistente

Sistema Web de Gestión de Rifas. Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe.

**La referencia funcional y técnica vigente es [`docs/DOCUMENTACION_SISTEMA.md`](docs/DOCUMENTACION_SISTEMA.md).** Léela antes de modificar el sistema y valida siempre el código, tipos y migraciones relacionados.

## Rol esperado

Senior Software Engineer dentro de un repo existente. Inspeccionar → comprender → extender. No reescribir por preferencia estilística. No iniciar proyecto nuevo.

## Stack

Next.js 16.2.12 (App Router) · React 19.2.8 · TypeScript 5 estricto · Tailwind CSS v4 (sin config.js) · Supabase (PostgreSQL/Auth/Storage/Realtime) · Zod v4.4.3 (no v3) · motion + gsap/@gsap/react (animación) · Render.

## No negociable

- PostgreSQL es la fuente de verdad. El backend controla precio, disponibilidad, vencimiento, aprobación, numeración de tickets. El navegador nunca decide esto.
- Venta unitaria: `ticket_price × requestedQuantity`, calculado SIEMPRE en backend/RPC. **Paquetes fueron eliminados por el cliente — nunca reintroducir `packages`/`raffle_packages`.**
- Monolito modular, sin microservicios. No crear carpetas paralelas (`api-v2`, `services2`, `dashboard-new`).
- Operaciones críticas (aprobación, asignación de tickets, activar/cerrar rifa) son atómicas vía RPC/PostgreSQL con `SECURITY DEFINER` + `search_path` fijo.
- Realtime es solo informativo — reconsultar siempre tras un evento. Implementado como broadcast puro (sin datos de fila) que solo dispara `router.refresh()`; ver `src/lib/realtime/`.
- `service_role` solo en servidor (`src/lib/supabase/admin.ts`), nunca en cliente ni en `NEXT_PUBLIC_*`.
- Comprobantes en Storage privado, URLs firmadas de vida corta. Fotos públicas (premio, promociones) en el bucket público compartido `raffle-images`.
- Ganador manual, único **por premio** (una rifa puede tener varios premios), irreversible incluso para `service_role`. Nunca automatizar selección de ganador. Se muestra públicamente con nombre enmascarado (primer nombre + inicial del apellido) — nunca el nombre completo ni el DNI.
- Un ticket de rifa cancelada se congela. Reasignarlo crea otro ticket trazable en una rifa activa; nunca se mueve, reutiliza, imprime ni elige como ganador el original.
- Seguimiento y documento público requieren DNI + código de seguimiento. El DNI no es un secreto suficiente.
- Toda imagen se reencoda antes de Storage: el navegador reduce primero y el servidor es el respaldo autoritativo; no persistir originales.
- No agregar dependencias sin justificar explícitamente.

## Estado

El sistema está desplegado en **https://perla-dorada.onrender.com** mediante Render. Las funcionalidades y reglas vigentes se describen en la documentación general; el código y las migraciones siguen siendo la fuente de verdad para cualquier cambio.

**Construido después de la Fase 7 (23 jul → 2 ago 2026), no perderlo de vista:**
- **Rediseño de marca** (23 jul): sitio pasó a ser web de marca de joyería con el sorteo como sección intercambiable — ver "Sitio público" y "Panel administrativo" más abajo.
- **Ciclo de vida de tickets + seguimiento reusable** (27 jul, migración `20260727171136` + `20260727222740`): `ticket_status` active/frozen/reassigned, reasignación trazable con `origin_ticket_id`, código de seguimiento por documento (reusable entre compras, no por solicitud).
- **Rifas con múltiples premios** (24 jul, ampliado 2 ago): `raffles.prizes` (jsonb, cada elemento con `id` estable vía `assign_prize_ids`).
- **Realtime de portada** (1 ago): crear/activar/editar/cerrar/cancelar/eliminar una rifa emite un broadcast puro (`public:raffle-events`, sin datos de fila); la portada escucha y hace `router.refresh()`. Ver `src/lib/realtime/`.
- **Modal de promociones administrable** (1-2 ago, migración `20260801120000`): carrusel de bienvenida gestionado íntegramente desde `/admin/promotions` (foto, texto, vigencia, destino del CTA). Reemplazó una config estática que ya no existe.
- **Ganador por premio + mostrado públicamente** (2 ago, migración `20260802120000` + `20260802120100`): `register_raffle_winner` acepta `p_prize_id` y registra un ganador por premio. La última rifa cerrada con ganador reemplaza la sección del sorteo mientras no exista una rifa activa, con nombre enmascarado. Un ticket ganador se ve dorado en `/seguimiento/tickets`.
- Reserva de tickets: 60 → **360 minutos (6h)**. 3 cuentas administrativas activas (antes 1).

**Despliegue: el proyecto va en RENDER (no Vercel).** Hay DOS Render Cron Jobs, cada uno con curl `Authorization: Bearer <CRON_SECRET>`:
- `/api/cron/expire-requests` — cada ~15 min (marca solicitudes vencidas).
- `/api/cron/retention` — diario (elimina comprobantes 15 días tras cierre).
Variables de entorno en el dashboard de Render: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, RATE_LIMIT_SECRET, CRON_SECRET.

**Nota de entorno:** Supabase local NO corre; se aplican migraciones al remoto con `supabase db push --linked` (CLI ya linkeada, password cacheada, no pide interacción) y se regeneran tipos con `supabase gen types typescript --linked > src/types/database.ts` (redirigir vía bash para UTF-8). El `.env.local` apunta al remoto vivo **con datos reales de producción** (ya no es una rifa de prueba) → sirve para verificación E2E con `npm run dev`, pero con cuidado: `raffle_winners` es inmutable incluso para `service_role`, así que nunca insertar un ganador de prueba sin permiso explícito del usuario. El warning `pgdelta ... cert ENOENT` al final de `db push` es inocuo (cache de catálogo experimental), las migraciones sí se aplican.

## Sitio público (rediseño 23 jul 2026)

El sitio es una **web de marca de joyería** con el sorteo como sección que aparece/desaparece: las rifas son marketing, se hacen 3-4 veces al año, así que la web debe funcionar los 8-9 meses sin rifa activa.

- Estilo "lujo sobrio": negro profundo + oro envejecido como acento. Tokens en `src/app/globals.css` (`@theme`), tipografías Cormorant Garamond (display) + Inter (texto) vía `next/font` (auto-hospedadas, compatibles con la CSP).
- Animación con **motion** (`src/components/site/reveal.tsx`), lenta y una sola vez; respeta `prefers-reduced-motion`.
- Componentes del sitio en `src/components/site/` (público). El admin usa un patrón híbrido: kit compartido en `src/components/admin/` (ui.tsx, confirm-dialog.tsx) + formularios/acciones específicos de cada ruta colocados junto a su `page.tsx`, como antes.
- **Todo lo no configurado se oculta solo**: redes, contacto, vitrina y datos de pago. Nada de enlaces rotos ni secciones vacías.
- Datos a completar por el cliente: `src/config/brand.ts` (redes, contacto, **Yape**, datos legales) y `src/config/vitrina.ts` (fotos de piezas). Assets en `public/marca/` (ver su README).
- Foto del premio: se sube desde `/admin/raffles/[id]/edit` al bucket **público** `raffle-images` (columna `raffles.image_path`). El origen de Supabase está permitido en `img-src` de la CSP. El mismo bucket también aloja las fotos de premios de la lista (`raffles.prizes[].image_path`) y las de promociones (`/admin/promotions`), cada una en su subcarpeta.
- Modal de promociones: se abre a los 2 segundos de cada carga con contenido vigente, se administra en `/admin/promotions` y no usa configuración estática.
- Páginas legales en `/legal/{terminos,bases,privacidad,devoluciones}`: **borradores** pendientes de revisión legal. Al aprobarse, poner `LEGAL_ES_BORRADOR = false` en `src/app/legal/legal-document.tsx` para quitar el aviso.

## Panel administrativo (rediseño 23 jul 2026)

Comparte paleta y tipografía con el sitio público, pero **con densidad de herramienta**: menos aire, controles compactos, sin animaciones lentas. Aplicar el "lujo sobrio" literal a tablas de datos empeoraría el trabajo diario.

- Kit compartido en `src/components/admin/ui.tsx`: `adminCard`, `adminInput`, `adminLabel`, `btnPrimary/Ghost/Danger/Success/Small`, y componentes `AdminPage`, `AdminPageHeader`, `Badge`, `AdminAlert`, `EmptyState`. Usarlo en vez de escribir clases sueltas.
- Los **badges de estado conservan color semántico** (verde/rojo/ámbar): ahí el color es información que se escanea, no decoración. Igual la reimpresión, que sigue en ámbar por ser acción con cupo limitado.
- La **hoja imprimible del ticket se mantiene clara** (`/admin/tickets/[id]/print` y el documento de `/seguimiento/tickets`): va a papel. La cabecera del panel lleva `print:hidden`.
- Navegación con sección activa en `src/app/admin/admin-nav.tsx`.

## Workflows disponibles (skills de este proyecto)

- `/pd-contexto` — revisa el código, los tipos, las migraciones y `docs/DOCUMENTACION_SISTEMA.md` antes de proponer o aplicar cambios.

## Protocolo antes de escribir código

1. Inspeccionar árbol real, buscar rutas/RPC/tablas/migraciones relacionadas — no asumir nombres, usar `src/types/database.ts` y SQL real.
2. Informar qué existe, qué falta, qué archivos se van a tocar.
3. Cambios pequeños e incrementales. Server Components por defecto, `'use client'` solo si hace falta.
4. Validación Zod en el límite HTTP; reglas críticas en DB/RPC.

## Secuencia tras cada migración

```bash
npx supabase db push --linked
npx supabase gen types typescript --linked > src/types/database.ts
npx tsc --noEmit --pretty false   # corregir TODOS los errores antes de seguir
npm run lint
npm run build
```

## Prohibido

Reintroducir paquetes · convertir en e-commerce · integración automática con Yape · selección automática de ganador · múltiples rifas activas simultáneas · WhatsApp/email automáticos · microservicios · exponer comprobantes públicamente · service role en `NEXT_PUBLIC_*` · aceptar precio/estado/total desde el navegador · modificar tickets o ganador tras confirmación.
