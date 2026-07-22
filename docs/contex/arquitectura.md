PD-CC-03 · Arquitectura, convenciones y prompt maestro

Sistema Web de Gestión de Rifas — Joyería Perla Dorada Cliente: Freydi · Responsable técnico: Alexander Huanaco Quispe · 22 jul 2026 · Árbol de carpetas y stack corregidos tras auditoría técnica del código el 22 jul 2026 (ver docs/contex/estado_proyecto.md §1.1 para hallazgos completos)

1. Rol esperado de Claude Code

Actuar como Senior Software Engineer dentro de un repositorio existente. Inspeccionar → comprender → extender. No iniciar proyecto nuevo ni sustituir decisiones aprobadas.

Desafiar supuestos solo con evidencia técnica concreta
Distinguir hechos confirmados, inferencias y propuestas
No inventar tablas, RPC, rutas ni tipos
Pedir aclaración solo si es realmente bloqueante (una sola pregunta)
Priorizar cambios mínimos y reversibles
Mantener compatibilidad con Next.js 16 y React 19
2. Arquitectura de capas
[ Navegador público / administrador ]
              |
            HTTPS
              |
[ Next.js 16 · Vercel — monolito modular ]
  ├─ Server Components (por defecto)
  ├─ Client Components ('use client' solo cuando necesario)
  ├─ Route Handlers
  └─ Servicios de dominio (lib/)
              |
  ┌───────────┬──────────────┬─────────────┐
  │  Supabase │  Supabase    │  Supabase   │
  │   Auth    │ PostgreSQL   │  Storage    │
  │           │  + RPC       │  privado    │
  └───────────┴──────────────┴─────────────┘
                    +
             Supabase Realtime (informativo)
Capa	Responsabilidad	No debe hacer
UI pública	Presentación, captura, feedback	Decidir precio, aprobación, vencimiento o disponibilidad final
UI administrativa	Operación autenticada, confirmaciones	Acceder con service role desde cliente
Route Handlers	Auth, validación, rate limit, orquestación, respuesta HTTP	Duplicar transacciones complejas fila por fila
Servicios/lib	Reglas reutilizables, mapeo de errores, adaptadores	Depender de componentes React
RPC/PostgreSQL	Invariantes, locking, atomicidad, secuencias, estados terminales	Emitir mensajes de UI acoplados
Storage	Persistir comprobantes privados	Exponer rutas públicas permanentes
Realtime	Notificar cambios	Ser fuente de verdad
3. Estructura de carpetas — real (verificada por inspección directa, 22 jul 2026)
src/
├── proxy.ts                 ← Next.js 16: reemplaza el antiguo middleware.ts. ⚠️ Hay un proxy.ts duplicado en la raíz del repo con matcher distinto — resolver antes de tocar auth (ver estado_proyecto.md §1.1)
├── app/
│   ├── (rutas públicas: page.tsx, seguimiento/)
│   ├── admin/                ← incluye rutas API embebidas, ej. purchase-requests/[id]/approve/route.ts
│   └── api/
├── config/
├── lib/
│   ├── (módulos de dominio: raffles/)
│   ├── security/
│   ├── storage/
│   ├── supabase/
│   └── validation/
└── types/
    └── database.ts

supabase/
└── migrations/

⚠️ src/components/{public,admin}/ NO EXISTE en el repo actual — es la estructura que este documento originalmente esperaba, pero el código real coloca cada componente cliente junto a su ruta (ej. src/app/admin/raffles/raffle-form.tsx, no src/components/admin/RaffleForm.tsx). Dos caminos posibles, a decidir con el equipo antes de escribir código nuevo: (a) adoptar la convención ya en uso (componentes colocados) y descartar esta sección como aspiracional, o (b) migrar los componentes existentes a src/components/ como refactor explícito. NO crear src/components/ a medias ni mezclar ambos patrones sin decisión explícita.

No crear carpetas paralelas como services2, api-v2 o dashboard-new. Reutilizar la organización encontrada. (Confirmado: cero carpetas paralelas o duplicadas existen hoy, salvo el proxy.ts duplicado ya señalado.)

4. Convenciones TypeScript
TypeScript estricto; evitar any (usar unknown + refinamiento)
Usar tipos de src/types/database.ts (generados por Supabase)
Tipar argumentos RPC con Database['public']['Functions']
Server Components por defecto; agregar 'use client' solo para estado/eventos/APIs browser
No importar módulos server-only en componentes cliente
Usar Promise<NextResponse> en Route Handlers cuando sea útil
Centralizar esquemas Zod y mapeos de errores por módulo
Zod instalado es v4.4.3 (confirmado en package.json) — NO v3; si se busca referencia externa, verificar que sea de v4 (manejo de errores e inferencia difieren)
5. Convenciones Next.js
App Router exclusivamente — no crear pages/
Autorización administrativa siempre en servidor
redirect('/admin/login') cuando no exista sesión administrativa
router.refresh() tras mutaciones administrativas (si la página depende de Server Components)
Cache-Control: no-store en respuestas sensibles o variables
No confiar en parámetros de ruta sin validación
runtime='nodejs' en endpoints que procesen archivos o usen APIs incompatibles con Edge
6. Supabase y seguridad
typescript
// ✅ Contexto autenticado del usuario
createClient()

// ✅ Solo en servidor y cuando RLS no sea suficiente
createAdminClient()

// ❌ Nunca
process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
Las migraciones son la única forma de modificar el esquema
Después de migrar → regenerar src/types/database.ts en UTF-8
RLS debe probarse con: usuario público, administrador y sesión ausente
Comprobantes en bucket privado; URL firmada con vida corta y bajo autorización
7. Contrato de entrada — qué confiar del cliente
✅ Confiable (input del cliente)	❌ No confiable (calcular en backend)
fullName	ticketPrice
dni	totalAmount
phone	raffleId seleccionado libremente
whatsapp	expiresAt
requestedQuantity	status
paymentProof	ticket numbers

El backend obtiene la rifa activa, valida cantidad y disponibilidad, calcula cualquier total y crea la reserva.

8. Patrón de Route Handler
typescript
// Orden obligatorio:
1. Validar método y content-type
2. Aplicar límites de tamaño si corresponde
3. Autenticar y autorizar
4. Aplicar rate limit en endpoints públicos sensibles
5. Parsear y validar con Zod
6. Invocar servicio o RPC
7. Compensar recursos externos si la transacción falla
8. Mapear errores técnicos a mensajes controlados
9. Registrar detalle técnico sin datos sensibles
10. Responder con status HTTP coherente + Cache-Control: no-store
9. Convenciones de migraciones y RPC
Una migración por cambio lógico; nombres descriptivos y cronológicos
Constraints antes que validaciones solo de aplicación
Índices en: raffle_id, dni, tracking_code, status, ticket_number
Funciones críticas: SECURITY DEFINER con search_path fijo y permisos mínimos
Bloqueo transaccional o equivalente para correlativos y disponibilidad
RPC idempotentes cuando puedan reintentarse
Revocar EXECUTE público si no corresponde
10. Secuencia obligatoria de validación tras cada cambio
bash
# 1. Aplicar migración
supabase db push  # o migración local controlada

# 2. Regenerar tipos en UTF-8
supabase gen types typescript --local > src/types/database.ts

# 3. Verificar tipos
npx tsc --noEmit --pretty false
# → Corregir TODOS los errores antes de continuar

# 4. Lint
npm run lint

# 5. Build
npm run build

# 6. Pruebas funcionales del bloque modificado

No ejecutar lint o build como sustituto de revisión de tipos. No ocultar errores con casts indiscriminados.

11. Estrategia de cambios — protocolo antes de escribir
Antes de escribir:
  → Listar archivos relacionados
  → Buscar símbolos, rutas, tablas, RPC y migraciones existentes
  → Informar qué existe, qué falta y qué archivos modificarás
  → Señalar contradicciones entre código, tipos y documentos

Antes de crear una tabla: confirmar que no existe
Antes de crear una ruta: confirmar que no hay equivalente
Antes de cambiar un RPC: inspeccionar todos sus callers
Antes de instalar dependencia: justificarla explícitamente

Durante:
  → Cambios pequeños e incrementales
  → Server Components por defecto
  → 'use client' solo cuando sea necesario

Entrega:
  → Comandos reproducibles
  → Plan de rollback
  → No borrar código sin demostrar que está obsoleto
12. Prohibiciones explícitas
❌ Prohibido
Reintroducir paquetes (packages, raffle_packages)
Convertir el sistema en e-commerce
Integrar automáticamente con Yape
Seleccionar ganador automáticamente
Crear múltiples rifas activas
Agregar WhatsApp / email automáticos
Crear microservicios
Exponer comprobantes públicamente
Almacenar service role en variables NEXT_PUBLIC_*
Aceptar precio o estado enviados por el navegador
Modificar tickets o ganador después de confirmados
Crear carpetas paralelas (api-v2, services2, etc.)
Reescribir módulos completos por preferencia estilística
13. Prompt maestro — pegar al iniciar sesión de Claude Code
Actúa como Senior Software Engineer, Software Architect y Systems Analyst
dentro de un repositorio existente.

PROYECTO
Sistema Web de Gestión de Rifas — MVP para Joyería Perla Dorada.
Representante del cliente: Freydi.
Responsable técnico: Alexander Huanaco Quispe.

STACK OBLIGATORIO
- Next.js 16, App Router
- React 19
- TypeScript estricto
- Tailwind CSS
- Supabase PostgreSQL, Auth, Storage y Realtime
- Vercel · Zod

CONTEXTO ARQUITECTÓNICO
- Monolito modular.
- PostgreSQL es la fuente de verdad.
- El backend controla precio, disponibilidad, vencimiento, aprobación, numeración y permisos.
- Las operaciones críticas se ejecutan de forma atómica mediante RPC/PostgreSQL.
- Supabase Realtime es informativo; después de un evento se reconsulta.
- Los comprobantes están en Storage privado.
- Service role solo puede usarse en servidor.
- Integridad y seguridad tienen prioridad sobre rendimiento.

CORRECCIÓN DE ALCANCE CRÍTICA
Los documentos iniciales hablan de paquetes. Esa funcionalidad fue ELIMINADA por el cliente.
NO implementes tablas, rutas, formularios ni lógica de paquetes.
La venta es unitaria:
- cada rifa tiene ticket_price;
- el usuario selecciona requestedQuantity mediante contador;
- total visual = ticket_price × requestedQuantity;
- el servidor NUNCA confía en precio o total enviados por el navegador.

REGLAS DE NEGOCIO
- Solo una rifa activa.
- Una solicitud pendiente por DNI y rifa.
- Reserva de 60 minutos, configurable en app_settings.
- Pago por Yape con validación manual.
- Comprobante JPG/PNG/WEBP, máximo 5 MB.
- Aprobación y asignación de tickets atómicas.
- Tickets correlativos por rifa, únicos y nunca reutilizados.
- Estados de solicitud: pending, approved, rejected, expired (terminales irreversibles).
- Máximo de reimpresiones configurable (actual: 5).
- Ganador manual, único e irreversible.
- Consulta pública por DNI + tracking code.
- Comprobantes eliminados 15 días después del cierre de la rifa.
- Dos cuentas administrativas creadas manualmente.

YA CONSTRUIDO — NO DUPLICAR
- Scaffold Next.js y configuración.
- Clientes Supabase browser/server/admin.
- Health endpoint.
- Esquema inicial y tipos generados (src/types/database.ts).
- Autenticación administrativa.
- Bucket privado y flujo de comprobantes.
- Rate limiting de solicitudes.
- POST /api/purchase-requests (multipart, Zod, Storage, RPC, compensación).
- Dashboard administrativo de solicitudes.
- Aprobación y rechazo — RPC y route handlers completos, PERO rotos en UI por bug de ruteo (/api/admin/purchase-requests/... vs /admin/purchase-requests/...). Corregir es la prioridad #1, ver docs/contex/pendiente.md Bloque 0.
- Asignación atómica de tickets (bloqueada en la práctica por el bug anterior).
- ticket_prints y register_ticket_print (esta ruta SÍ funciona, sin bug de ruteo).
- UI de impresión — es HTML + window.print(), no genera PDF con librería (ninguna instalada). Confirmar con cliente si basta para el MVP.
- Seguimiento público.
- Búsqueda administrativa por DNI y ticket.
- CRUD de rifas: /admin/raffles, /admin/raffles/new, /admin/raffles/[id]/edit.
- Activar, cerrar y cancelar rifas.
- Tabla raffle_winners YA EXISTE en BD (inmutable, un ganador por rifa) — falta el RPC de registro y la UI.
- El proyecto actualmente compila (no re-verificado en esta auditoría; confirmar con npx tsc --noEmit antes de asumir).

FORMA DE TRABAJO OBLIGATORIA
Antes de modificar:
1. Inspecciona el árbol del repositorio.
2. Busca rutas, componentes, tablas, RPC y migraciones relacionadas.
3. Informa qué existe, qué falta y qué archivos modificarás.
4. Señala contradicciones entre código, tipos y documentos.
5. No asumas nombres de columnas o enums: usa src/types/database.ts y SQL real.

Durante:
- Cambios pequeños e incrementales.
- Server Components por defecto.
- 'use client' solo cuando sea necesario.
- Validación Zod en el límite HTTP.
- Reglas críticas en DB/RPC.
- Errores públicos controlados; detalle en logs.
- No usar any salvo imposibilidad explicada.
- No crear código paralelo o duplicado.

Después de cada migración:
1. Aplicar migración.
2. Regenerar tipos en UTF-8.
3. npx tsc --noEmit --pretty false.
4. Corregir errores.
5. npm run lint.
6. npm run build.
7. Pruebas del flujo modificado.

No comiences reescribiendo el sistema.
Empieza inspeccionando el repositorio y propón la siguiente subfase de mayor valor:
PORTAL PÚBLICO DE VENTA UNITARIA.
14. Plantilla de respuesta esperada de Claude Code
markdown
## Inspección
- Archivos encontrados:
- Funciones/RPC encontradas:
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

## Rollback
- Código:
- Base de datos:

## Definición de terminado
- [ ] tsc
- [ ] lint
- [ ] build
- [ ] pruebas

PD-CC-03 · Transferencia técnica Joyería Perla Dorada