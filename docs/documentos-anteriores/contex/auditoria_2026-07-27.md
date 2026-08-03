# Auditoría integral — 27 de julio de 2026

> **Archivo histórico — 2 ago 2026.** Todo lo descrito aquí está aplicado al remoto, desplegado en producción (Render) y verificado desde el 23 jul 2026. El contenido vigente vive ahora en `arquitectura.md` §2.1 (invariantes de ciclo de vida de tickets) y `pendiente.md` §3.2 (resumen técnico). Se conserva este archivo como referencia histórica de la auditoría original, no como fuente de verdad del estado actual.

Estado original (27 jul 2026, ya superado): cambios locales validados; la migración aún no se ha aplicado al remoto ni se ha publicado la aplicación.

## Correcciones implementadas

- Privacidad: seguimiento y descarga de tickets vuelven a requerir **DNI + código de seguimiento**. Las firmas antiguas quedan cerradas con un error controlado para que una ventana de despliegue no exponga datos por DNI.
- Seguimiento: el código ahora identifica al participante (tipo de documento + número), no a cada solicitud. Todas sus compras reutilizan el mismo código; las solicitudes y boletos conservan su trazabilidad independiente. Los códigos históricos se mantienen como alias de migración y el código canónico se muestra en adelante.
- Tickets: cancelar una rifa congela los tickets emitidos. La reasignación requiere un administrador activo y una rifa nueva activa; crea un ticket nuevo trazable y conserva el original como `reassigned`.
- Integridad: solo se elimina un borrador totalmente vacío. Nunca se eliminan solicitudes, tickets ni ganadores por borrar una rifa.
- Compra: límite autoritativo de 30 tickets por solicitud, en interfaz, Zod y PostgreSQL.
- Imágenes: navegador y servidor reencodan antes de Storage. Comprobantes: máximo final 600 KiB y 2000 px; imágenes públicas: 350 KiB y 1920 px. El servidor es el respaldo para navegadores sin Canvas y elimina metadatos.
- Acceso y operación: páginas admin exigen perfil activo, crons comparan secretos en tiempo constante, health verifica realmente Supabase y CSP valida el origen configurado.
- Dependencias: Next, React, Supabase y sus transitorios vulnerables se actualizaron/sobrescribieron. `npm audit --omit=dev` queda en cero vulnerabilidades.

## Ciclo de vida de tickets cancelados

1. Al cancelar una rifa, los tickets vigentes pasan a `frozen` y no se imprimen ni pueden ganar.
2. Al habilitar una rifa nueva, el panel muestra **Reasignar a esta rifa** para cada ticket congelado.
3. La reasignación crea un ticket nuevo `active` con número correlativo en la rifa destino y enlaza `origin_ticket_id` al ticket anterior.
4. El ticket anterior pasa a `reassigned`, se conserva como historial y no vuelve a ser imprimible ni ganador.

## Despliegue coordinado obligatorio

La migración `20260727171136_harden_ticket_lifecycle_and_purchase_limits.sql` cambia contratos de RPC y debe ir junto con esta versión de la aplicación. Aplicar primero la migración cierra de forma segura las consultas antiguas (sin filtrar información), y publicar inmediatamente esta aplicación. Luego regenerar `src/types/database.ts` desde el remoto y ejecutar las pruebas funcionales indicadas abajo.

## Verificación pendiente en entorno remoto

- Cancelar una rifa con tickets aprobados: todos quedan `frozen`.
- Intentar imprimir o elegir como ganador un ticket congelado/reasignado: debe fallar.
- Activar nueva rifa y reasignar un ticket: debe crear exactamente un ticket activo, correlativo y trazable.
- Confirmar que seguimiento y descarga devuelven 404 con DNI o código incorrecto, y funcionan con ambos válidos.
- Subir JPG/PNG/WEBP de 1–5 MB desde un navegador sin Canvas simulado: Storage debe recibir WebP dentro de los límites.
