/*
 * Límite operativo por solicitud. La base de datos lo replica como
 * invariante; este valor solo evita que la interfaz prometa algo imposible.
 */
export const MAX_TICKETS_PER_PURCHASE_REQUEST = 50;
