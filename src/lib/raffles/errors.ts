export type MappedRaffleError = {
  status: number;
  message: string;
};

export function mapRaffleDatabaseError(
  databaseMessage: string,
): MappedRaffleError {
  const message =
    databaseMessage.trim();

  switch (message) {
    case "ADMIN_NOT_ACTIVE":
      return {
        status: 403,
        message:
          "El administrador no está activo.",
      };

    case "RAFFLE_NOT_FOUND":
      return {
        status: 404,
        message: "La rifa no existe.",
      };

    case "RAFFLE_NAME_TOO_SHORT":
      return {
        status: 400,
        message:
          "El nombre debe tener al menos 3 caracteres.",
      };

    case "RAFFLE_NAME_TOO_LONG":
      return {
        status: 400,
        message:
          "El nombre no puede superar los 150 caracteres.",
      };

    case "RAFFLE_DESCRIPTION_TOO_LONG":
      return {
        status: 400,
        message:
          "La descripción no puede superar los 2000 caracteres.",
      };

    case "INVALID_TICKET_PRICE":
      return {
        status: 400,
        message:
          "El precio del ticket debe ser mayor que cero.",
      };

    case "INVALID_TOTAL_TICKETS":
    case "TOTAL_TICKETS_TOO_HIGH":
      return {
        status: 400,
        message:
          "La cantidad total de tickets no es válida.",
      };

    case "CLOSES_AT_MUST_BE_AFTER_STARTS_AT":
      return {
        status: 400,
        message:
          "La fecha de cierre debe ser posterior a la fecha de inicio.",
      };

    case "DRAW_AT_MUST_NOT_BE_BEFORE_CLOSES_AT":
      return {
        status: 400,
        message:
          "La fecha del sorteo no puede ser anterior al cierre.",
      };

    case "RAFFLE_NOT_EDITABLE":
      return {
        status: 409,
        message:
          "Una rifa cerrada o cancelada no puede editarse.",
      };

    case "TICKET_PRICE_LOCKED":
      return {
        status: 409,
        message:
          "No se puede cambiar el precio porque la rifa ya tiene solicitudes.",
      };

    case "TOTAL_TICKETS_BELOW_ASSIGNED_MAX":
      return {
        status: 409,
        message:
          "El total no puede ser menor que el ticket más alto ya asignado.",
      };

    case "RAFFLE_NOT_DRAFT":
      return {
        status: 409,
        message:
          "Solo una rifa en borrador puede activarse.",
      };

    case "RAFFLE_CLOSE_DATE_REQUIRED":
      return {
        status: 400,
        message:
          "Debes indicar la fecha de cierre antes de activar la rifa.",
      };

    case "RAFFLE_DRAW_DATE_REQUIRED":
      return {
        status: 400,
        message:
          "Debes indicar la fecha del sorteo antes de activar la rifa.",
      };

    case "ANOTHER_ACTIVE_RAFFLE_EXISTS":
      return {
        status: 409,
        message:
          "Ya existe otra rifa activa.",
      };

    case "RAFFLE_NOT_ACTIVE":
      return {
        status: 409,
        message:
          "Solo una rifa activa puede cerrarse.",
      };

    case "RAFFLE_NOT_CANCELLABLE":
      return {
        status: 409,
        message:
          "Esta rifa ya no puede cancelarse.",
      };

    case "RAFFLE_HAS_WINNER":
      return {
        status: 409,
        message:
          "No se puede cancelar una rifa que ya tiene ganador.",
      };

    default:
      return {
        status: 500,
        message:
          "No se pudo completar la operación con la rifa.",
      };
  }
}