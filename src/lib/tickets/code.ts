const TICKET_CODE_PATTERN = /^(?:PD-)?(\d+)$/i;

export function formatTicketCode(ticketNumber: number): string {
  if (!Number.isSafeInteger(ticketNumber) || ticketNumber <= 0) {
    throw new RangeError("El número de ticket debe ser un entero positivo.");
  }

  return `PD-${String(ticketNumber).padStart(4, "0")}`;
}

export function parseTicketCode(value: string): number | null {
  const match = TICKET_CODE_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
