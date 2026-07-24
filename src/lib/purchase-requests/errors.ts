/*
 * Mapeo de errores de aprobar / rechazar una solicitud.
 *
 * Antes se decidía el código HTTP buscando palabras en INGLÉS ("pending",
 * "not found"…) dentro del mensaje del error, pero approve_purchase_request y
 * reject_purchase_request lanzan sus mensajes en ESPAÑOL. Ninguna palabra
 * coincidía, así que cualquier conflicto real (reserva vencida, solicitud ya
 * revisada, no existe) terminaba en un 500 genérico y el admin no sabía qué
 * pasó.
 *
 * La forma fiable de clasificar es por el `errcode` de PostgreSQL, que es
 * independiente del idioma. Los RPC usan:
 *   P0002 → la solicitud o la rifa no existe        → 404
 *   P0001 → conflicto de estado / disponibilidad    → 409
 *   42501 → el usuario no es administrador activo    → 403
 *   22023 → dato inválido                            → 400
 *
 * Los mensajes de esos RPC son de negocio y seguros de mostrar al admin, así
 * que se propagan tal cual salvo en 404, donde se normaliza el texto.
 */

type DatabaseError = {
  code?: string;
  message: string;
};

export type MappedRequestError = {
  status: number;
  message: string;
};

export function mapPurchaseRequestActionError(
  error: DatabaseError,
  fallbackMessage: string,
): MappedRequestError {
  switch (error.code) {
    case "P0002":
      return { status: 404, message: "La solicitud no existe." };

    case "P0001":
      return { status: 409, message: error.message };

    case "42501":
      return {
        status: 403,
        message: "El administrador no está activo.",
      };

    case "22023":
      return { status: 400, message: error.message };

    default:
      return { status: 500, message: fallbackMessage };
  }
}
