PD-CC-03 · Arquitectura, convenciones y prompt maestro

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · **Reescrito el 2 ago 2026** — estructura de carpetas corregida (`src/components/` sí existe), patrones nuevos documentados (§2.2-2.5), prompt maestro actualizado a Render y al estado real del proyecto.

## 1. Rol esperado de Claude Code

Actuar como Senior Software Engineer dentro de un repositorio existente. Inspeccionar → comprender → extender. No iniciar proyecto nuevo ni sustituir decisiones aprobadas.

- Desafiar supuestos solo con evidencia técnica concreta.
- Distinguir hechos confirmados, inferencias y propuestas.
- No inventar tablas, RPC, rutas ni tipos — usar `src/types/database.ts` y SQL real.
- Pedir aclaración solo si es realmente bloqueante.
- Priorizar cambios mínimos y reversibles.
- Mantener compatibilidad con Next.js 16 y React 19.

## 2. Arquitectura de capas

```
[ Navegador público / administrador ]
              |
            HTTPS
              |
[ Next.js 16 · Render — monolito modular ]
  ├─ Server Components (por defecto)
  ├─ Client Components ('use client' solo cuando necesario)
  ├─ Route Handlers
  └─ Servicios de dominio (lib/)
              |
  ┌───────────┬──────────────┬─────────────┐
  │  Supabase │  Supabase    │  Supabase   │
  │   Auth    │ PostgreSQL   │  Storage    │
  │           │  + RPC       │  (privado + │
  │           │              │   público)  │
  └───────────┴──────────────┴─────────────┘
                    +
      Supabase Realtime (broadcast informativo)
```

| Capa | Responsabilidad | No debe hacer |
|---|---|---|
| UI pública | Presentación, captura, feedback | Decidir precio, aprobación, vencimiento, disponibilidad o quién ganó |
| UI administrativa | Operación autenticada, confirmaciones | Acceder con service role desde cliente |
| Route Handlers | Auth, validación, rate limit, orquestación, respuesta HTTP | Duplicar transacciones complejas fila por fila |
| Servicios/lib | Reglas reutilizables, mapeo de errores, adaptadores | Depender de componentes React |
| RPC/PostgreSQL | Invariantes, locking, atomicidad, secuencias, estados terminales | Emitir mensajes de UI acoplados |
| Storage | Persistir comprobantes privados y fotos públicas | Exponer comprobantes con URL pública permanente |
| Realtime | Notificar que algo cambió | Ser fuente de verdad — quien recibe la señal siempre reconsulta |

### 2.1 Invariantes del ciclo de vida de tickets (auditoría 27 jul 2026)

- Un ticket congelado (`frozen`) procede de una rifa cancelada: no se imprime ni puede ganar.
- Reasignar requiere administrador activo y una rifa destino activa; inserta un ticket nuevo correlativo con `origin_ticket_id` y conserva el anterior como `reassigned` (historial, nunca se mueve ni reutiliza).
- Las consultas públicas nunca se autorizan con DNI aislado — siempre DNI + código de seguimiento.
- Entrada de imagen ≤5 MB; objeto persistido ≤600 KiB (comprobantes) o ≤350 KiB (imágenes públicas: premios, promociones). El backend es la defensa final, el navegador solo optimiza primero.

### 2.2 Patrón: broadcast de Realtime (informativo, sin datos de fila)

Cuando algo público debe refrescarse en vivo (hoy: la portada tras cambios de rifa), el flujo es:

1. `src/lib/realtime/channels.ts` — exporta el nombre del canal como constante compartida (ej. `PUBLIC_RAFFLE_CHANNEL`).
2. Un helper server-only (`src/lib/realtime/public-raffle-events.ts`) crea el `createAdminClient()`, abre ese canal y hace `channel.send({ type: "broadcast", event: "changed", payload: {} })` — **sin datos de negocio en el payload**, solo la señal. Se llama al final de cada ruta admin que muta el recurso, después de `recordAuditEvent`. Un fallo al emitir la señal se traga y se loguea; nunca debe romper la operación admin que la origina.
3. Un componente cliente "watcher" (ej. `RealtimeRaffleWatcher`, montado una vez en `page.tsx`) usa el cliente browser (`createClient()` de `@/lib/supabase/client`), se suscribe al mismo canal y, al recibir el evento, llama `router.refresh()`. Nunca actualiza estado local con el payload.

Reutilizar este patrón (mismo trío: constante de canal → emisor server-only → watcher cliente) para cualquier feature futura que necesite "avisar sin ser la fuente de verdad".

### 2.3 Patrón: subida de imágenes en dos tiempos (staging)

Toda foto pública (premio mayor, premios de la lista, fotos de promoción) sigue el mismo camino:

1. **Cliente**: comprime en Canvas (`src/lib/images/compress-client.ts`, perfil `RAFFLE_IMAGE_COMPRESSION` — 1920px / 300 KiB / WebP) antes de subir. Si Canvas falla, se sube el archivo original tal cual (el servidor es el respaldo).
2. **Servidor**: un endpoint de "staging" (`/api/admin/raffles/prize-image`, `/api/admin/promotions/image`) recibe el archivo, lo valida por bytes reales (`file-type`, no extensión), lo reencoda con `sharp` a WebP dentro del límite final (`src/lib/storage/images.ts`), y lo sube al bucket público **antes** de que exista el registro que lo referencia. Devuelve solo la ruta (`path`).
3. El formulario guarda esa ruta como texto plano; al enviar el recurso completo (crear/editar rifa o promoción), la ruta viaja como un campo más — el RPC o la ruta de guardado nunca maneja archivos.
4. Todas las fotos públicas comparten el bucket `raffle-images` (subcarpetas `raffles/`, `prizes/`, `promotions/`) en vez de crear un bucket por feature — mismas políticas (solo `service_role` escribe, lectura pública), menos que administrar.

### 2.4 Patrón: identidad estable dentro de listas JSONB descriptivas

`raffles.prizes` es una lista descriptiva (jsonb), no una tabla. Cuando una fila de OTRA tabla necesita referenciar "este elemento concreto de la lista" (como `raffle_winners.prize_id`), la solución no es crear una tabla relacional — es asignarle un `id` (uuid) a cada elemento en el momento de guardarlo:

- `normalize_raffle_prizes()` sigue siendo el validador puro (`immutable`, sin generar nada aleatorio) — preserva un `id` si ya viene y es un uuid válido, pero no lo inventa.
- `assign_prize_ids()` (`volatile`, porque llama `gen_random_uuid()`) es un paso aparte que sí genera id para los elementos que no lo traen. Se invoca envolviendo la salida de `normalize_raffle_prizes()` dentro de `create_raffle`/`update_raffle`.
- La tabla que referencia el id (`raffle_winners.prize_id`) guarda además una **copia congelada** de los campos que importan mostrar después (`prize_title`, `prize_image_path`), para no depender de que el jsonb original no cambie ni de tener que parsearlo en cada lectura pública.

### 2.5 Lecciones operativas de esta sesión

- **Nunca reconstruyas de memoria el cuerpo de un RPC que vas a modificar.** Antes de escribir `create or replace function` sobre una función existente, lee su definición completa y actual (la migración más reciente que la toca, o `pg_get_functiondef` contra el remoto si hay dudas de cuál migración es la vigente) y cambia solo la línea que necesitas. Reconstruir de memoria casi revirtió silenciosamente una validación de negocio real (`TICKET_PRICE_LOCKED`) en `update_raffle` durante el trabajo de ganador-por-premio — se detectó comparando contra el archivo fuente antes de aplicar.
- **`AnimatePresence` (motion) y `createPortal` (react-dom) no se anidan en cualquier orden.** `AnimatePresence` filtra sus hijos con `React.isValidElement`; un `ReactPortal` no lo es, así que si el portal queda DENTRO de `AnimatePresence` (`<AnimatePresence>{createPortal(...)}</AnimatePresence>`), el hijo se descarta en silencio y no se renderiza nada — sin error, sin warning. El portal siempre debe ENVOLVER a `AnimatePresence`, nunca al revés: `createPortal(<AnimatePresence>...</AnimatePresence>, document.body)`.
- **`useSyncExternalStore` para saber si ya estás en cliente, no `useEffect` + `setState`.** El patrón clásico `useEffect(() => setMounted(true), [])` dispara un warning del linter de hooks (cascading render). El reemplazo correcto: `useSyncExternalStore(() => () => {}, () => true, () => false)` — sin efecto, sin cascada, mismo resultado (false en servidor/primer render, true tras hidratar).
- **Un ganador insertado es literalmente irreversible, incluso para pruebas.** Los triggers de inmutabilidad no distinguen `service_role`. Antes de ejecutar cualquier prueba en vivo contra `register_raffle_winner`, evaluar si el camino de éxito puede probarse sin insertar (casos de error, que sí revierten solos) o si hace falta pedir permiso explícito al usuario para dejar un registro permanente.

## 3. Estructura de carpetas — real (verificada por inspección directa, 2 ago 2026)

`src/components/` **existe** y se usa de forma híbrida — corrige lo que decían versiones anteriores de este documento:

```
src/
├── proxy.ts                 ← Next.js 16, reemplaza middleware.ts
├── app/                      ← rutas públicas, admin (con componentes de ruta colocados junto a su page.tsx) y api/
├── components/
│   ├── site/                ← TODO el portal público vive aquí (no colocado junto a la ruta)
│   └── admin/                ← solo el kit compartido (ui.tsx, confirm-dialog.tsx); cada ruta admin sigue
│                                 colocando sus propios formularios/acciones junto a su page.tsx
├── config/                   ← brand.ts, vitrina.ts, app.ts, storage.ts, purchase.ts
├── lib/
│   ├── raffles/, promotions/, purchase-requests/, realtime/
│   ├── security/, storage/, supabase/, validation/, images/, audit/, auth/
│   └── env.ts, format.ts, datetime-lima.ts, clipboard.ts, use-lock-body-scroll.ts
└── types/
    └── database.ts

supabase/
└── migrations/                ← 35 archivos, cronológicos 2026-07-21 → 2026-08-02
```

**Regla para código nuevo**: un componente que pertenece al **portal público** y no es específico de una sola ruta va a `src/components/site/`. Un componente **admin** compartido entre varias rutas (botones, badges, layout) va a `src/components/admin/`; un formulario o acción específica de UNA ruta admin (ej. el formulario de editar una rifa) sigue colocado junto a esa ruta, como ya se hacía. No migrar retroactivamente sin que se pida explícitamente — no mezclar el patrón a medias en una misma feature.

No crear carpetas paralelas (`services2`, `api-v2`, `dashboard-new`). Cero carpetas paralelas o duplicadas existen hoy.

## 4. Convenciones TypeScript

- TypeScript estricto; evitar `any` (usar `unknown` + refinamiento).
- Usar tipos de `src/types/database.ts` (generados por Supabase).
- Tipar argumentos RPC con `Database['public']['Functions']`.
- Server Components por defecto; `'use client'` solo para estado/eventos/APIs de navegador.
- No importar módulos `server-only` en componentes cliente.
- `Promise<NextResponse>` en Route Handlers cuando sea útil.
- Centralizar esquemas Zod y mapeos de errores por módulo (`lib/<dominio>/validation.ts`, `lib/<dominio>/errors.ts`).
- Zod instalado es v4.4.3 — NO v3; si se busca referencia externa, verificar que sea de v4.

## 5. Convenciones Next.js

- App Router exclusivamente — no crear `pages/`.
- Autorización administrativa siempre en servidor; `redirect('/admin/login')` cuando no exista sesión.
- `router.refresh()` tras mutaciones administrativas que dependan de Server Components.
- `Cache-Control: no-store` en respuestas sensibles o variables.
- No confiar en parámetros de ruta sin validación (patrón UUID explícito antes de cualquier query).
- `runtime='nodejs'` en endpoints que procesen archivos o usen APIs incompatibles con Edge.

## 6. Supabase y seguridad

```typescript
// ✅ Contexto autenticado del usuario
createClient()          // @/lib/supabase/server (Server Component/Route Handler) o /client (navegador)

// ✅ Solo en servidor — RPC SECURITY DEFINER o CRUD directo con requireActiveAdmin()
createAdminClient()     // @/lib/supabase/admin, siempre con "server-only"

// ❌ Nunca
process.env.SUPABASE_SERVICE_ROLE_KEY en un Client Component o NEXT_PUBLIC_*
```

- Las migraciones son la única forma de modificar el esquema.
- Después de migrar → regenerar `src/types/database.ts` en UTF-8 (`supabase gen types typescript --linked > ...` vía bash para el encoding).
- Sin RLS clásico — patrón DEC-03 (§5 de `estado_proyecto.md`): `REVOKE ALL` + `SECURITY DEFINER` otorgado a `service_role`, o CRUD directo con `requireActiveAdmin()` para contenido no crítico.
- Comprobantes en bucket privado; URL firmada con vida corta. Fotos públicas (premio, promociones) en bucket público, sin políticas para `anon`/`authenticated` — solo `service_role` escribe.

## 7. Contrato de entrada — qué confiar del cliente

| ✅ Confiable (input del cliente) | ❌ No confiable (calcular en backend) |
|---|---|
| `fullName`, `dni`, `phone`, `whatsapp` | `ticketPrice`, `totalAmount` |
| `requestedQuantity` | `raffleId` seleccionado libremente (se resuelve la rifa activa en servidor) |
| `paymentProof` | `expiresAt`, `status`, ticket numbers |
| Elección de premio/enlace en formularios admin | Quién ganó, disponibilidad final |

El backend obtiene la rifa activa, valida cantidad y disponibilidad, calcula cualquier total y crea la reserva.

## 8. Patrón de Route Handler

```
1. Validar método y content-type
2. Aplicar límites de tamaño si corresponde
3. Autenticar y autorizar (getClaims + requireActiveAdmin si la ruta no pasa por un RPC con assert_active_admin)
4. Aplicar rate limit en endpoints públicos sensibles
5. Parsear y validar con Zod
6. Invocar servicio o RPC
7. Compensar recursos externos si la transacción falla (ej. borrar imagen huérfana en Storage)
8. Mapear errores técnicos a mensajes controlados (por error.code, nunca por substring en inglés)
9. Registrar en audit_log (recordAuditEvent) sin datos sensibles
10. Emitir broadcast si el recurso es público y necesita refresco en vivo (§2.2)
11. Responder con status HTTP coherente + Cache-Control: no-store
```

## 9. Convenciones de migraciones y RPC

- Una migración por cambio lógico; nombres descriptivos y cronológicos (`YYYYMMDDHHMMSS_descripcion.sql`).
- Constraints antes que validaciones solo de aplicación.
- Índices en: `raffle_id`, `dni`, `tracking_code`, `status`, `ticket_number`, y cualquier columna usada en un índice único parcial.
- Funciones críticas: `SECURITY DEFINER` con `search_path` fijo (`''`) y permisos mínimos (`revoke all` + `grant execute` explícito a `service_role`).
- Si el RETURN TYPE de una función cambia, no basta `create or replace` — hay que `drop function if exists (firma exacta)` primero. Si solo cambia el cuerpo con la misma firma, `create or replace` alcanza.
- Bloqueo transaccional (`for update`) para correlativos y disponibilidad.
- RPC idempotentes cuando puedan reintentarse (crons).
- Antes de tocar un RPC existente: leer su definición completa vigente, no solo el fragmento que se va a cambiar (ver lección en §2.5).

## 10. Secuencia obligatoria de validación tras cada cambio

```bash
# 1. Aplicar migración al remoto (no hay Supabase local corriendo en este entorno)
npx supabase db push --linked

# 2. Regenerar tipos en UTF-8
npx supabase gen types typescript --linked > src/types/database.ts

# 3. Verificar tipos
npx tsc --noEmit --pretty false
# → Corregir TODOS los errores antes de continuar

# 4. Lint
npm run lint

# 5. Build
npm run build

# 6. Pruebas funcionales del bloque modificado (contra el remoto real cuando sea seguro; ver nota abajo)
```

No ejecutar lint o build como sustituto de revisión de tipos. No ocultar errores con casts indiscriminados.

**Nota sobre pruebas contra el remoto**: el `.env.local` apunta a la base **viva** de producción, así que sirve para verificación E2E real (`npm run dev` o `npx next start`). Es una ventaja para confirmar comportamiento real, pero exige cuidado: no dejar datos de prueba en tablas con filas inmutables (`raffle_winners`), limpiar cualquier fila de prueba en tablas mutables, y preferir probar caminos de error (que no escriben nada) antes que caminos de éxito cuando el resultado no se puede deshacer.

## 11. Estrategia de cambios — protocolo antes de escribir

Antes de escribir:
- Listar archivos relacionados.
- Buscar símbolos, rutas, tablas, RPC y migraciones existentes.
- Informar qué existe, qué falta y qué archivos se van a modificar.
- Señalar contradicciones entre código, tipos y documentos.

Antes de crear una tabla: confirmar que no existe. Antes de crear una ruta: confirmar que no hay equivalente. Antes de cambiar un RPC: inspeccionar todos sus callers (grep del nombre en `src/`) y leer su cuerpo completo actual. Antes de instalar dependencia: justificarla explícitamente.

Durante: cambios pequeños e incrementales, Server Components por defecto, `'use client'` solo cuando sea necesario.

Entrega: comandos reproducibles, plan de rollback, no borrar código sin demostrar que está obsoleto.

## 12. Prohibiciones explícitas

❌ Prohibido:
- Reintroducir paquetes (`packages`, `raffle_packages`).
- Convertir el sistema en e-commerce.
- Integrar automáticamente con Yape.
- Seleccionar ganador automáticamente.
- Crear múltiples rifas activas simultáneas.
- Agregar WhatsApp / email automáticos.
- Crear microservicios.
- Exponer comprobantes públicamente.
- Almacenar service role en variables `NEXT_PUBLIC_*`.
- Aceptar precio, estado o total enviados por el navegador.
- Modificar tickets o ganador después de confirmados.
- Mostrar el nombre completo o el DNI de un ganador en el sitio público (solo primer nombre + inicial del apellido, ticket y premio).
- Crear carpetas paralelas (`api-v2`, `services2`, etc.) o mezclar a medias el patrón `src/components/` con el patrón colocado (§3).
- Reescribir módulos completos por preferencia estilística.
- Insertar un ganador de prueba en el remoto sin permiso explícito del usuario (es irreversible y se mostraría como real en público).

## 13. Prompt maestro — pegar al iniciar sesión de Claude Code

```
Actúa como Senior Software Engineer, Software Architect y Systems Analyst
dentro de un repositorio existente.

PROYECTO
Sistema Web de Gestión de Rifas y web de marca — Joyería Perla Dorada.
Representante del cliente: Freydi. Responsable técnico: Alexander Huanaco Quispe.
Desplegado en producción: https://perla-dorada.onrender.com (Render, no Vercel).

STACK OBLIGATORIO
- Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS v4.
- Supabase PostgreSQL, Auth, Storage (privado + público) y Realtime (broadcast informativo).
- motion (animación de sitio) + gsap/@gsap/react (stage rig). Zod v4.
- Render (Web Service + 2 Cron Jobs).

CONTEXTO ARQUITECTÓNICO
- Monolito modular. PostgreSQL es la fuente de verdad.
- El backend controla precio, disponibilidad, vencimiento, aprobación, numeración y ganador.
- Operaciones críticas: RPC SECURITY DEFINER. Contenido no crítico (settings, promociones):
  CRUD directo con requireActiveAdmin().
- Realtime es informativo; después de un evento se reconsulta, nunca se confía en el payload.
- Comprobantes en Storage privado; fotos públicas (premio, promociones) en bucket público
  compartido raffle-images.
- Service role solo en servidor.

CORRECCIÓN DE ALCANCE CRÍTICA
Los documentos iniciales hablan de paquetes. Fue ELIMINADO por el cliente. Venta unitaria:
ticket_price × requestedQuantity, calculado siempre en backend.

REGLAS DE NEGOCIO VIGENTES
- Solo una rifa activa. Una solicitud pendiente por DNI y rifa.
- Reserva de 360 minutos (6h), configurable en app_settings.
- Máximo 30 tickets por solicitud. Pago por Yape, validación manual.
- Comprobante JPG/PNG/WEBP, máx 5 MB de entrada, reencodado antes de Storage.
- Aprobación y asignación de tickets atómicas, correlativos, nunca reutilizados.
- Ticket: active → frozen (rifa cancelada) → reassigned (historial) + nuevo active trazable.
- Ganador: manual, único POR PREMIO (una rifa puede tener varios premios), irreversible,
  mostrado públicamente con nombre enmascarado (primer nombre + inicial del apellido).
- Consulta pública por DNI + código de seguimiento (reusable entre compras del mismo documento).
- Comprobantes eliminados 15 días después del cierre de la rifa.
- 3 cuentas administrativas activas.

YA CONSTRUIDO — NO DUPLICAR (ver docs/contex/estado_proyecto.md para el detalle completo)
Todo el ciclo público→admin→ganador está completo y en producción: portal, aprobación,
tickets, impresión pública/admin, ganador por premio mostrado en portada, promociones
administrables, realtime de portada, auditoría, retención, rate limiting, cabeceras de
seguridad, rediseño de marca completo (portal + admin).

FORMA DE TRABAJO OBLIGATORIA
Antes de modificar:
1. Inspecciona el árbol del repositorio real (no asumas por este prompt).
2. Busca rutas, componentes, tablas, RPC y migraciones relacionadas.
3. Lee el cuerpo COMPLETO de cualquier RPC que vayas a modificar, no solo un fragmento.
4. Informa qué existe, qué falta y qué archivos vas a modificar.
5. No asumas nombres de columnas o enums: usa src/types/database.ts y SQL real.

Durante:
- Cambios pequeños e incrementales. Server Components por defecto.
- 'use client' solo cuando sea necesario. Validación Zod en el límite HTTP.
- Reglas críticas en DB/RPC. Errores públicos controlados; detalle en logs.
- No usar any salvo imposibilidad explicada. No crear código paralelo o duplicado.

Después de cada migración:
1. supabase db push --linked
2. supabase gen types typescript --linked > src/types/database.ts (UTF-8)
3. npx tsc --noEmit --pretty false — corregir TODOS los errores
4. npm run lint
5. npm run build
6. Pruebas del flujo modificado (con cuidado si toca raffle_winners: irreversible)

No comiences reescribiendo el sistema. Empieza inspeccionando el repositorio y pregunta
por la siguiente prioridad si no es evidente.
```

## 14. Plantilla de respuesta esperada de Claude Code

```markdown
## Inspección
- Archivos encontrados:
- Funciones/RPC encontradas (cuerpo completo leído, no fragmento):
- Tipos relevantes:
- Riesgos o contradicciones:

## Alcance de esta iteración
- Incluye:
- No incluye:

## Plan de cambios
1.
2.
3.

## Archivos
- Crear:
- Modificar:
- No tocar:

## Implementación
[código o patches completos]

## Comandos
[comandos exactos y reproducibles]

## Pruebas
- Tipo:
- Pasos:
- Resultado esperado:
- ⚠️ Si toca tablas con filas inmutables (raffle_winners): ¿el camino de éxito es seguro
  de probar en vivo, o hace falta permiso explícito del usuario?

## Rollback
- Código:
- Base de datos:

## Definición de terminado
- [ ] tsc
- [ ] lint
- [ ] build
- [ ] pruebas
```

PD-CC-03 · Transferencia técnica Joyería Perla Dorada
