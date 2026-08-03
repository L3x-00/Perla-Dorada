# Documentación general del sistema

## Descripción

Perla Dorada Rifas es la web de marca de Joyería Perla Dorada con un sistema administrable de sorteos. Cuando no hay una rifa activa, el sitio funciona como vitrina y muestra el último resultado publicado de forma segura.

La aplicación usa Next.js App Router, React, TypeScript y Tailwind CSS. Render aloja el servicio web y Supabase aporta PostgreSQL, Auth, Storage y Realtime.

## Arquitectura

| Capa | Responsabilidad |
|---|---|
| Aplicación | Páginas, componentes y Route Handlers de Next.js. |
| PostgreSQL | Fuente de verdad para precios, reservas, tickets y resultados. |
| RPC | Reglas transaccionales críticas y control de invariantes. |
| Supabase Auth | Sesiones y validación de perfiles administradores. |
| Supabase Storage | Comprobantes privados e imágenes públicas optimizadas. |
| Supabase Realtime | Señales de actualización; la interfaz siempre vuelve a consultar. |

El navegador nunca decide precio, disponibilidad, vencimiento, aprobación, numeración de tickets ni ganadores. Estas decisiones se validan en servidor y en la base de datos.

## Portal público

### Sitio de marca

- Inicio, vitrina, Nosotros y contacto configurables.
- Tema claro y oscuro guardado en el navegador.
- Diseño adaptable, animaciones compatibles con `prefers-reduced-motion` y páginas de error y 404 consistentes con la marca.

### Compra de boletos

1. La persona abre el sorteo activo.
2. Completa nombres, apellidos, documento, teléfono y WhatsApp.
3. Los campos válidos se marcan en verde; el formulario guía al siguiente campo al completar el actual.
4. Elige hasta 50 boletos, paga por Yape y adjunta una imagen del comprobante.
5. Se crea una reserva temporal y se entrega un código de seguimiento.

Un documento puede mantener hasta 10 solicitudes pendientes para la misma rifa. El código de seguimiento se reutiliza en todas las compras del mismo documento; la consulta nunca se habilita solo con DNI.

### Seguimiento, tickets y ganadores

- El seguimiento requiere tipo de documento, número y código.
- Se muestran todas las solicitudes de la persona y su estado: pendiente, aprobada, rechazada o expirada.
- Las solicitudes aprobadas permiten consultar, descargar e imprimir tickets.
- El resultado público muestra solo primer nombre e inicial del apellido, junto
  con la ciudad o distrito declarado al registrar al ganador; nunca dirección
  exacta ni DNI.
- Cada fila de premio admite un ganador; varios ganadores requieren filas de premio independientes.

### Promociones

Las promociones activas y vigentes se muestran en un carrusel dos segundos después de cada carga de la portada. El botón cierra el modal antes de redirigir al sorteo o enlace configurado.

## Panel administrativo

El panel requiere una cuenta activa en `admin_profiles` y permite:

- Crear, editar, activar, cerrar, cancelar y eliminar borradores vacíos.
- Revisar comprobantes, aprobar o rechazar solicitudes y asignar tickets.
- Buscar por nombre, documento, teléfono o código visual `PD-####`; una entrada numérica consulta tanto datos del participante como el número exacto de ticket.
- Consultar tickets agrupados por solicitud de compra y rifa, con conteo de tickets, filtros por sorteo, fecha, ciclo y sorteo actual/pasado, además de paginación de 20 grupos.
- Imprimir un ticket vigente o todos los tickets vigentes de una misma solicitud y rifa. Las impresiones administrativas son ilimitadas; cada reimpresión exige un motivo y conserva administrador, fecha, secuencia y tanda para auditoría.
- Reasignar de forma trazable los tickets congelados de una rifa cancelada.
- Crear y administrar promociones, imágenes, vigencias y enlaces.
- Configurar mantenimiento y duración de reservas.
- Usar el menú Perfil para volver al sitio, cambiar tema y cerrar sesión.

Las APIs administrativas sin sesión responden `401` JSON; las páginas protegidas redirigen a `/admin/login`.

Antes de imprimir se puede elegir uno de estos perfiles, sin registrar una nueva reimpresión al cambiar la selección:

- **Térmica 72 mm:** usa un ancho físico máximo de 72 mm y un área segura de contenido de 64 mm para tolerar cabezales de 576 o 512 puntos. Las opciones A y B emulan una densidad legible o compacta con tipografía monoespaciada; la fuente térmica física, los DPI y el corte dependen del controlador de la impresora. Configurar escala 100 %, márgenes en cero y desactivar encabezados y pies del navegador.
- **General adaptable:** ocupa el ancho imprimible disponible hasta 180 mm y sirve para A4, Carta, impresoras de tinta, láser y otros tamaños configurados en el navegador.

La selección queda guardada en el navegador para las siguientes ventanas de impresión. El comprobante que descarga el cliente conserva nombre del negocio, sorteo, código y datos necesarios. La impresión administrativa para ánforas usa deliberadamente un talón mínimo, sin borde ni relleno: código `PD-####`, fecha y hora de compra en Lima (`YYYY-MM-DD HH:mm:ss`), nombre completo en mayúsculas y teléfono. Una tanda contiene exclusivamente los tickets vigentes de una solicitud y una rifa, con un salto de página o corte entre tickets.

`PD-####` es el código visual del ticket y el relleno de cuatro dígitos es mínimo (`PD-10000` no se trunca). La base mantiene la unicidad real mediante la combinación rifa + número; rutas, APIs, auditoría y relaciones siguen utilizando UUID y números internos. Por ello, toda pantalla presenta el código dentro del contexto de su rifa.

## Reglas de negocio

| Entidad | Regla |
|---|---|
| Rifa | `draft → active → closed`; solo una puede estar activa. También puede cancelarse. |
| Solicitud | `pending → approved | rejected | expired`; un estado terminal no se revierte. |
| Ticket | Se crea tras la aprobación, es correlativo por rifa, se muestra como `PD-####` y no se reutiliza. |
| Rifa cancelada | Sus tickets se congelan; no se imprimen ni participan como ganadores. |
| Reasignación | Crea un ticket nuevo trazable en una rifa activa y conserva el original. |
| Ganador | Manual, inmutable y único por fila de premio. |
| Comprobante | Privado; se elimina por retención 15 días después del cierre o cancelación. |

## Imágenes y almacenamiento

Los comprobantes aceptan JPG, PNG o WebP de hasta 5 MB de entrada. El navegador intenta comprimir y el servidor vuelve a validar bytes reales, orientación, metadatos, tamaño y píxeles. No se conservan los originales.

| Tipo | Bucket | Límite almacenado |
|---|---|---|
| Comprobante de pago | `payment-proofs` privado | 600 KiB y 2000 px |
| Imagen de rifa, premio o promoción | `raffle-images` público | 350 KiB y 1920 px |

## Seguridad

- Zod valida entradas HTTP y PostgreSQL mantiene las reglas autoritativas.
- Las operaciones sensibles usan RPC transaccionales con permisos limitados y `search_path` fijo.
- `SUPABASE_SERVICE_ROLE_KEY` se usa solo en servidor, nunca en el cliente.
- Los comprobantes usan bucket privado y URL firmada de vida corta.
- Los talones de ánfora contienen teléfono por necesidad operativa y deben permanecer bajo custodia administrativa hasta el sorteo.
- Las operaciones públicas tienen rate limiting y las imágenes se verifican por tipo real de archivo, tamaño y píxeles.
- Realtime no transmite datos privados: emite una señal y la UI recarga datos desde el servidor.

## Datos principales

| Recurso | Contenido |
|---|---|
| `raffles` | Sorteos, precios, fechas, imágenes, premios y estado. |
| `purchase_requests` | Participante, comprobante, reserva y estado. |
| `tickets` | Número correlativo, ciclo de vida y origen de reasignación. |
| `ticket_prints` | Auditoría de originales y reimpresiones; las impresiones conjuntas comparten un identificador de tanda. |
| `raffle_winners` | Ticket, premio y ciudad/distrito del ganador; es inmutable. |
| `participant_tracking_codes` | Código canónico reutilizable por documento. |
| `participant_tracking_code_aliases` | Compatibilidad con códigos históricos. |
| `promotions` | Contenido, imagen, vigencia, orden y CTA. |
| `admin_profiles` | Usuarios autorizados para operar el panel. |
| `app_settings` | Configuración global de operación. |
| `audit_log` | Registro de operaciones administrativas críticas. |

El repositorio contiene 43 migraciones versionadas en `supabase/migrations/`.

## Operación y despliegue

### Variables de entorno

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
RATE_LIMIT_SECRET
CRON_SECRET
```

No se guardan valores de estas variables en el repositorio.

`LOG_LEVEL` es opcional (`debug`, `info`, `warn` o `error`) y por defecto usa `info`.

### Observabilidad en Render

El backend emite registros JSON estructurados a los logs de Render. Cada solicitud procesada por el Proxy recibe un `x-request-id`, que permite relacionar la ruta, método, duración y decisión de acceso con los errores de servidor. No se registran DNI, nombres, teléfonos, comprobantes, códigos de seguimiento, cookies, tokens, secretos ni motivos de reimpresión.

Eventos relevantes:

- `service.started`: arranque de una instancia.
- `http.proxy.completed` y `http.proxy.failed`: tránsito y errores en el Proxy de autenticación.
- `request.unhandled_error`: excepción no controlada capturada globalmente por Next.js, con ruta sin parámetros sensibles.
- `application.console_error`: error de servidor existente normalizado al formato estructurado.
- `ticket.print.batch_registered` y `ticket.print.batch_failed`: impresión conjunta desde una solicitud aprobada.
- `ticket.print.batch_missing_result` y `ticket.print.batch_invalid_result`: respuesta inesperada del registro atómico; la API se cierra sin abrir un documento inconsistente.

Render conserva y muestra estos eventos en **Logs**. Para localizar un caso, buscar el `request_id` o el nombre del evento; no hace falta exponer información del cliente para investigar un fallo.

### Tareas Cron de Render

| Ruta | Frecuencia | Función |
|---|---|---|
| `/api/cron/expire-requests` | Aproximadamente cada 15 minutos | Marca reservas vencidas. |
| `/api/cron/retention` | Diaria | Ejecuta la retención de comprobantes. |

Ambas usan `Authorization: Bearer <CRON_SECRET>`.

## Desarrollo

### Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- `.env.local` configurado para Supabase.

### Inicio local

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Validaciones

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

### Cambios de esquema

```bash
supabase migration new <nombre-descriptivo>
supabase db push --linked
supabase gen types typescript --linked > src/types/database.ts
```

No crear ganadores de prueba en producción: son inmutables y se publicarían como resultados reales.

## Estructura del proyecto

```text
src/app/                 rutas, páginas y Route Handlers
src/components/site/     componentes del portal público
src/components/admin/    componentes compartidos del panel
src/lib/                 validación, seguridad, Supabase y Storage
src/config/              marca, vitrina, compra y almacenamiento
src/types/database.ts    tipos generados desde Supabase
supabase/migrations/     historial de esquema
```

Antes de cambiar una función, revisar rutas, tipos generados, migraciones y reglas de negocio relacionadas. Usar Server Components por defecto y componentes cliente solo para interacciones del navegador.
