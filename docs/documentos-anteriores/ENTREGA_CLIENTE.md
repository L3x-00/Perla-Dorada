# Entrega al cliente — Joyería Perla Dorada

## Qué es el sistema

Es una web de marca para la joyería con un módulo de rifas administrable. Cuando
no hay una rifa activa, el sitio continúa funcionando como vitrina y muestra el
último resultado publicado de forma segura.

## Funcionalidades entregadas

- Administración de rifas: crear borradores, editar, activar, cerrar, cancelar
  y eliminar únicamente borradores sin actividad.
- Compra pública: nombres y apellidos por separado, guía de avance entre
  campos, estado visual de campos válidos, selección de cantidad, pago por
  Yape, carga de comprobante y reserva temporal de tickets.
- Seguimiento: un mismo código por documento para consultar todas las compras;
  la consulta exige documento y código.
- Revisión administrativa: ver comprobante, aprobar o rechazar solicitudes y
  asignar tickets correlativos.
- Tickets: consulta e impresión, control de reimpresiones y reasignación
  trazable si una rifa se cancela.
- Ganadores: registro manual, irreversible y por fila de premio; el sitio
  muestra solo el primer nombre e inicial, nunca el DNI completo.
- Promociones: carrusel de bienvenida administrable desde el panel, visible
  en cada recarga cuando hay promociones vigentes; su botón cierra el modal y
  redirige al destino configurado.
- Panel administrativo: buscador visible en el inicio y menú Perfil para
  volver al sitio, cambiar tema y cerrar sesión.
- Imagen y almacenamiento: toda foto se comprime en navegador cuando es
  posible y se valida/reencoda nuevamente en el servidor antes de Storage.

## Flujos de uso

### Participante

1. Ingresa al sorteo activo y completa nombres, apellidos y sus datos; cada
   campo válido se confirma visualmente y la guía continúa al siguiente.
2. Realiza el pago por Yape y adjunta la captura del comprobante.
3. Guarda el código de seguimiento mostrado al finalizar.
4. Consulta el estado con su tipo de documento, número y código.
5. Tras la aprobación, descarga o imprime sus tickets.

### Administrador

1. Crea una rifa en borrador y configura fechas, precio, tickets e imágenes.
2. Activa la rifa cuando esté lista para recibir solicitudes.
3. Revisa cada comprobante y aprueba o rechaza la solicitud.
4. Cierra la rifa al finalizar las ventas y registra el ganador de cada fila de
   premio con el ticket correcto.
5. Si una rifa se cancela, reasigna cada ticket congelado a una nueva rifa
   activa; el original queda conservado como historial.

## Reglas importantes

- Solo puede existir una rifa activa a la vez.
- Cada compra admite hasta 30 tickets; un documento puede mantener hasta 10
  solicitudes pendientes por rifa.
- Cada fila de premio admite un único ganador. La cantidad es descriptiva; si
  se necesitan varios ganadores del mismo concepto, se deben crear filas de
  premio separadas.
- No se eliminan tickets, solicitudes ni ganadores: se conserva la trazabilidad.
- Los comprobantes son privados y se eliminan por retención después de 15 días
  del cierre o cancelación de la rifa.

## Consideraciones técnicas y operativas

- Producción: Render (Web Service y dos tareas programadas) + Supabase.
- Las tareas programadas deben mantenerse activas: expiración de reservas cada
  ~15 minutos y retención diaria de comprobantes.
- Las páginas legales se entregan como borrador y requieren validación legal
  antes de su publicación definitiva.
- Es necesario rotar las claves de servicio y de rate limit expuestas en un
  incidente histórico, y actualizar esos valores en Render y `.env.local`.
- Se recomienda habilitar en Supabase Auth la protección contra contraseñas
  filtradas desde el Dashboard.

Para el detalle de pruebas, seguridad y riesgos residuales consultar
[`AUDITORIA_ENTREGA_2026-08-02.md`](AUDITORIA_ENTREGA_2026-08-02.md).
