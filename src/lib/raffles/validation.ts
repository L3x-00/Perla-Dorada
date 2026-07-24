import {
  parseHeroImagePath,
  parseRafflePrizes,
  type RafflePrize,
} from "@/lib/raffles/prizes";

export type RaffleInput = {
  name: string;
  description: string | null;
  ticketPrice: number;
  totalTickets: number;
  startsAt: string | null;
  closesAt: string | null;
  drawAt: string | null;
  imagePath: string | null;
  prizes: RafflePrize[];
};

export type RawRaffleInput =
  Record<string, unknown> & {
    name?: unknown;
    description?: unknown;
    ticketPrice?: unknown;
    totalTickets?: unknown;
    startsAt?: unknown;
    closesAt?: unknown;
    drawAt?: unknown;
    imagePath?: unknown;
    prizes?: unknown;
  };

function parseOptionalDate(
  value: unknown,
  fieldLabel: string,
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `${fieldLabel} no es válida.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${fieldLabel} no es válida.`,
    );
  }

  return date.toISOString();
}

export function parseRaffleInput(
  body: RawRaffleInput,
): RaffleInput {
  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim() || null
      : null;

  const ticketPrice =
    typeof body.ticketPrice === "number"
      ? body.ticketPrice
      : Number(body.ticketPrice);

  const totalTickets =
    typeof body.totalTickets === "number"
      ? body.totalTickets
      : Number(body.totalTickets);

  if (name.length < 3) {
    throw new Error(
      "El nombre debe tener al menos 3 caracteres.",
    );
  }

  if (name.length > 150) {
    throw new Error(
      "El nombre no puede superar los 150 caracteres.",
    );
  }

  if (
    description !== null &&
    description.length > 2000
  ) {
    throw new Error(
      "La descripción no puede superar los 2000 caracteres.",
    );
  }

  if (
    !Number.isFinite(ticketPrice) ||
    ticketPrice <= 0
  ) {
    throw new Error(
      "El precio del ticket debe ser mayor que cero.",
    );
  }

  if (
    !Number.isSafeInteger(totalTickets) ||
    totalTickets <= 0 ||
    totalTickets > 1_000_000
  ) {
    throw new Error(
      "La cantidad total de tickets no es válida.",
    );
  }

  const startsAt = parseOptionalDate(
    body.startsAt,
    "La fecha de inicio",
  );

  const closesAt = parseOptionalDate(
    body.closesAt,
    "La fecha de cierre",
  );

  const drawAt = parseOptionalDate(
    body.drawAt,
    "La fecha del sorteo",
  );

  if (
    startsAt !== null &&
    closesAt !== null &&
    new Date(closesAt).getTime() <=
      new Date(startsAt).getTime()
  ) {
    throw new Error(
      "La fecha de cierre debe ser posterior a la fecha de inicio.",
    );
  }

  if (
    closesAt !== null &&
    drawAt !== null &&
    new Date(drawAt).getTime() <
      new Date(closesAt).getTime()
  ) {
    throw new Error(
      "La fecha del sorteo no puede ser anterior al cierre.",
    );
  }

  const imagePath = parseHeroImagePath(body.imagePath);
  const prizes = parseRafflePrizes(body.prizes);

  return {
    name,
    description,
    ticketPrice,
    totalTickets,
    startsAt,
    closesAt,
    drawAt,
    imagePath,
    prizes,
  };
}