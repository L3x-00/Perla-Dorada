/*
 * Nombre de canal compartido entre el emisor (rutas admin, service_role) y el
 * receptor (portal público, anon key). Es un canal de broadcast puro: no
 * lleva datos de la rifa, solo avisa que algo cambió.
 */
export const PUBLIC_RAFFLE_CHANNEL = "public:raffle-events";
