# Perla Dorada Rifas — contexto persistente

Sistema Web de Gestión de Rifas. Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe.

**Este archivo se carga automáticamente en cada sesión. Es el resumen. La fuente de verdad completa está en `docs/contex/`:**
- `docs/contex/estado_proyecto.md` — stack exacto, qué está construido, árbol de archivos real, contrato de API
- `docs/contex/pendiente.md` — bloques de trabajo pendiente (A–G), reglas de negocio invariantes, criterios de aceptación
- `docs/contex/arquitectura.md` — capas, convenciones TS/Next.js, patrón de Route Handler, prohibiciones, prompt maestro
- `docs/contex/errores.md` — bitácora de bugs conocidos y deuda técnica, con estado actualizado

**Lee los 4 archivos de `docs/contex/` antes de tocar cualquier código si no los tienes ya en contexto de la sesión.** No asumas que este resumen basta para implementar nada.

## Rol esperado

Senior Software Engineer dentro de un repo existente. Inspeccionar → comprender → extender. No reescribir por preferencia estilística. No iniciar proyecto nuevo.

## Stack (versiones exactas — ver estado_proyecto.md §3)

Next.js 16.2.10 (App Router) · React 19.2.4 · TypeScript 5.9.3 estricto · Tailwind CSS v4 (sin config.js) · Supabase (PostgreSQL/Auth/Storage/Realtime) · Zod v4.4.3 (no v3) · Vercel.

## No negociable

- PostgreSQL es la fuente de verdad. El backend controla precio, disponibilidad, vencimiento, aprobación, numeración de tickets. El navegador nunca decide esto.
- Venta unitaria: `ticket_price × requestedQuantity`, calculado SIEMPRE en backend/RPC. **Paquetes fueron eliminados por el cliente — nunca reintroducir `packages`/`raffle_packages`.**
- Monolito modular, sin microservicios. No crear carpetas paralelas (`api-v2`, `services2`, `dashboard-new`).
- Operaciones críticas (aprobación, asignación de tickets, activar/cerrar rifa) son atómicas vía RPC/PostgreSQL con `SECURITY DEFINER` + `search_path` fijo.
- Realtime es solo informativo — reconsultar siempre tras un evento.
- `service_role` solo en servidor (`src/lib/supabase/admin.ts`), nunca en cliente ni en `NEXT_PUBLIC_*`.
- Comprobantes en Storage privado, URLs firmadas de vida corta.
- Ganador manual, único, irreversible. Nunca automatizar selección de ganador.
- No agregar dependencias sin justificar explícitamente (ver DEC-02 en errores.md sobre PDF).

## Estado — ver docs/contex/errores.md para el detalle completo

Sin bugs 🔴 bloqueantes activos (ERR-01 y ERR-04 corregidos el 22 jul 2026). Quedan 🟡 abiertos: ERR-02 (reservation_minutes no conectado al RPC), ERR-03 (sin scheduler de expiración), ERR-05 (grants faltantes en 3 RPC), ERR-06 (rate limiting solo en /api/purchase-requests).

**Bloques A y B completados el 22 jul 2026**, verificados E2E contra BD real. Bloque B: pantalla `/admin/settings` (mantenimiento, mensaje configurable, reserva, reimpresiones), enforcement 503 en el POST y landing, audit_log de cambios. Durante Bloque B se descubrió y corrigió **ERR-08**: `create_purchase_request` estaba roto (ambigüedad `raffle_id` + `gen_random_bytes` sin esquema) → NINGUNA solicitud pública real se podía crear; ahora POST → 201 verificado. ERR-02 también corregido (reservation_minutes).

Migraciones aplicadas al remoto (proyecto iewcowhkfsywdiyligsq): `20260722160000/160500/161000/163000/164000`. `database.ts` regenerado.

**Bloque C (expiración) completado el 22 jul 2026**, verificado E2E: cron `/api/cron/expire-requests` (Bearer CRON_SECRET) + `vercel.json` (*/15) + countdown en vivo. ERR-05 corregido (grants explícitos). Disponibilidad ya ignora vencidas (filtro expires_at > now()); el cron es higiene de estado.

⚠️ **ERR-09 (setup de datos, pendiente del usuario):** `admin_profiles` está VACÍA en el remoto → aprobar/rechazar fallan con "no es administrador activo" pese a que el admin inicie sesión. Sembrar admin_profiles (user_id de cada admin de auth + is_active=true) es un paso manual; no inventar user_id. Ver errores.md.

⚠️ **CRON_SECRET:** definir en variables de entorno de Vercel para que el cron de expiración funcione en producción.

**Bloque D (PDF/impresión) completado el 22 jul 2026**, verificado E2E. Descarga pública `/seguimiento/tickets` (RPC get_public_ticket_document + /api/tickets), documento A4 HTML print-to-PDF validado por DNI+code para solicitudes aprobadas. DEC-02 resuelta: sin librería PDF. Se confirmó además que aprobar→asignar tickets funciona al sembrar admin_profiles.

**Bloque E (ganador irreversible) completado el 22 jul 2026**, verificado E2E. RPC `register_raffle_winner` + ruta `/api/admin/raffles/[id]/winner` + UI con doble confirmación + vista de solo lectura. No expuesto públicamente (DEC-04). Dejó 1 rifa de prueba permanente en el remoto (ganador inmutable); SQL de limpieza en errores.md.

**Bloques A–E completos y verificados.** Próximos bloques: F (auditoría/retención — audit_log ya existe, extender a más acciones + retención de comprobantes 15 días), G (endurecimiento: ERR-06 rate-limit en /api/tracking y /api/tickets). Ver `docs/contex/pendiente.md` y `errores.md`.

**Despliegue: el proyecto va en RENDER (no Vercel).** El `vercel.json` con cron NO aplica en Render — la expiración periódica debe configurarse como un Render Cron Job que llame a `/api/cron/expire-requests` con el header `Authorization: Bearer <CRON_SECRET>`. Variables de entorno (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, RATE_LIMIT_SECRET, CRON_SECRET) se definen en el dashboard de Render.

**Nota de entorno:** Supabase local NO corre; se aplican migraciones al remoto con `supabase db push --linked` (CLI ya linkeada, password cacheada, no pide interacción) y se regeneran tipos con `supabase gen types typescript --linked > src/types/database.ts` (redirigir vía bash para UTF-8). El `.env.local` apunta al remoto vivo con rifa de prueba → sirve para verificación E2E con `npm run dev`. El warning `pgdelta ... cert ENOENT` al final de `db push` es inocuo (cache de catálogo experimental), las migraciones sí se aplican.

## Workflows disponibles (skills de este proyecto)

- `/pd-fases` — audita `pendiente.md` + `errores.md`, propone la siguiente subfase de mayor valor con el formato de respuesta de `arquitectura.md` §14 (Inspección → Alcance → Plan → Archivos → Implementación → Comandos → Pruebas → Rollback → Definición de terminado).
- `/pd-contexto` — re-audita el código real contra los 4 documentos de `docs/contex/` y corrige lo que haya quedado desactualizado (los docs describen el pasado; el código es la verdad).
- `/pd-errores` — revisa el código en busca de bugs nuevos, actualiza `docs/contex/errores.md` (agrega, cierra o reabre entradas).

## Protocolo antes de escribir código

1. Inspeccionar árbol real, buscar rutas/RPC/tablas/migraciones relacionadas — no asumir nombres, usar `src/types/database.ts` y SQL real.
2. Informar qué existe, qué falta, qué archivos se van a tocar.
3. Cambios pequeños e incrementales. Server Components por defecto, `'use client'` solo si hace falta.
4. Validación Zod en el límite HTTP; reglas críticas en DB/RPC.

## Secuencia tras cada migración

```bash
supabase db push
supabase gen types typescript --local > src/types/database.ts
npx tsc --noEmit --pretty false   # corregir TODOS los errores antes de seguir
npm run lint
npm run build
```

## Prohibido

Reintroducir paquetes · convertir en e-commerce · integración automática con Yape · selección automática de ganador · múltiples rifas activas simultáneas · WhatsApp/email automáticos · microservicios · exponer comprobantes públicamente · service role en `NEXT_PUBLIC_*` · aceptar precio/estado/total desde el navegador · modificar tickets o ganador tras confirmación.
