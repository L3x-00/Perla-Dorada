# Arquitectura vigente

La aplicación es un monolito modular de Next.js App Router, desplegado en
Render y respaldado por Supabase (PostgreSQL, Auth, Storage y Realtime).

- La base de datos es la fuente de verdad para disponibilidad, precios,
  reservas, tickets, ganadores y el ciclo de vida de una rifa.
- Las reglas críticas viven en RPC de PostgreSQL, transaccionales y con
  `SECURITY DEFINER`; el navegador nunca decide estos valores.
- El panel requiere un perfil de administrador activo. Los comprobantes se
  guardan en un bucket privado y las imágenes públicas se validan y reencodan
  antes de llegar a Storage.
- Una compra devuelve un código de seguimiento reutilizable por documento;
  la consulta pública siempre requiere documento y código.
- Un ticket cancelado se congela y solo puede reasignarse creando un nuevo
  ticket trazable. Los ganadores son manuales e inmutables.
- Realtime solo avisa que hubo un cambio: la interfaz siempre recarga el dato
  desde el servidor y nunca confía en el payload del evento.

La referencia técnica completa para mantenimiento está en
[`contex/arquitectura.md`](contex/arquitectura.md). El documento orientado al
cliente está en [`ENTREGA_CLIENTE.md`](ENTREGA_CLIENTE.md).
