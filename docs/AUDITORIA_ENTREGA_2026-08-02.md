# Auditoría de entrega — 2 de agosto de 2026

## Alcance

Revisión integral de documentación, arquitectura Next.js/Supabase, rutas API,
RPC y migraciones, validación de seguridad, rendimiento, UX y preparación de
entrega. Se preservó un cambio local ajeno en
`src/components/site/participate.tsx`; no forma parte de esta auditoría.

## Correcciones aplicadas

| Severidad | Hallazgo | Corrección |
|---|---|---|
| Alta | Una cuenta autenticada sin perfil activo podía cargar páginas administrativas con datos personales si en el futuro se habilitaba registro Auth. | Se añadió `requireActiveAdminPage()` y se aplicó a todas las pantallas administrativas protegidas. |
| Media | Si fallaba la consulta de ganadores, la página podía mostrar un formulario como si no hubiera ganadores. | Las lecturas críticas de rifa, ganadores, tickets y participantes ahora detienen la página con un mensaje controlado. |
| Media | El proxy redirigía llamadas sin sesión a `/api/admin/*` hacia HTML de login, rompiendo el contrato de `fetch` JSON. | Las APIs administrativas sin sesión responden `401` JSON; las páginas continúan redirigiendo al login. |
| Media | Al quitar una foto se eliminaba Storage antes de despejar PostgreSQL; ante un fallo posterior podía quedar una URL rota. | Se actualiza la referencia en base primero y Storage se limpia después en modo best-effort. |
| Media | La cantidad de un premio se podía interpretar como varios ganadores. | La interfaz y la documentación aclaran que cada fila permite un ganador; se usan filas separadas para varios ganadores. |
| Baja | La disponibilidad pública esperaba dos consultas independientes de forma secuencial. | Conteo de tickets y reservas pendientes en paralelo, sin cambiar la validación transaccional autoritativa. |
| Baja | Dos funciones de PostgreSQL tenían advertencias de análisis estático por volatilidad y retorno del bucle. | La migración `20260802195922_harden_function_lint.sql` ajusta la volatilidad y hace explícito el máximo de intentos; fue aplicada y probada en remoto. |
| Baja | No había páginas de error y 404 alineadas con la identidad visual. | Se agregaron `error.tsx` y `not-found.tsx` con mensajes claros y acción de reintento. |
| Documentación | Las fases aún hablaban de Vercel/paquetes y el conteo de migraciones era incorrecto. | Se sincronizaron la arquitectura, fases, reglas de negocio, bitácora y documentos de entrega. |

## Seguridad revisada

- `npm audit --omit=dev` no reporta vulnerabilidades de dependencias de
  producción.
- Las 37 migraciones locales están aplicadas en el proyecto remoto. El linter
  solo conserva falsos positivos sobre parámetros y columnas de salida de dos
  funciones SQL; el asesor no detectó problemas de esquema, RLS o rendimiento.
- Las operaciones críticas usan RPC con permisos restringidos y `search_path`
  fijo; los comprobantes no se exponen públicamente.
- La carga de imágenes inspecciona los bytes reales, limita tamaño y píxeles,
  elimina metadatos y persiste una versión WebP reducida.
- El asesor remoto sí reporta una configuración pendiente: activar **Leaked
  Password Protection** en Supabase Auth. Requiere acción desde el Dashboard.

## Validación funcional

Se validan de forma segura las rutas públicas, las validaciones de entrada, la
autorización y las invariantes que evitan sobreventa, eliminación de trazas,
selección de ganadores no válida e impresión de tickets congelados. La prueba
de éxito de creación, aprobación, eliminación y ganador no se ejecuta contra
datos reales de producción porque crea reservas/tickets o inserta un ganador
irreversible. Debe ejecutarse en un entorno de prueba o con autorización
explícita para crear y conservar esos registros.

La eliminación de tickets no existe por diseño: se conserva el historial y se
usa cancelación/reasignación trazable. La eliminación de rifas se limita a
borradores vacíos.

## Riesgos y acciones del propietario

1. Rotar `SUPABASE_SERVICE_ROLE_KEY` y `RATE_LIMIT_SECRET` y actualizar Render
   y `.env.local`.
2. Confirmar los dos Cron Jobs de Render y su `CRON_SECRET`.
3. Habilitar Leaked Password Protection en Supabase Auth.
4. Aprobar legalmente las páginas de términos, privacidad, devoluciones y bases.
5. Definir el mensaje/estado de una solicitud pendiente cuando una rifa se
   cierre o cancele, y si el cierre debe ser automático al llegar `closes_at`.

## Resultado

El código queda preparado para producción bajo sus reglas de negocio actuales.
Las acciones pendientes son configuraciones externas, contenido legal y una
decisión de negocio; no se deben resolver con cambios automáticos de código.
