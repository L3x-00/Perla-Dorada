/*
 * Premios de una rifa.
 *
 * Se guardan como jsonb en raffles.prizes (ver migración 20260724120000).
 * Son DESCRIPTIVOS: enumeran lo que se sortea ("una moto", "2 x dinero en
 * efectivo", "un televisor") con cantidad y foto opcional. No cambian la
 * regla de ganador único y manual. Este módulo es el espejo en TS de las
 * reglas que impone normalize_raffle_prizes() en la base: la base sigue
 * siendo la autoridad; esto solo da errores tempranos y tipos.
 */

export type RafflePrize = {
  /**
   * Identidad estable del premio (la asigna el backend, ver
   * assign_prize_ids en la migración 20260802120000). null solo para un
   * premio nuevo que el admin todavía no guardó.
   */
  id: string | null;
  title: string;
  quantity: number;
  imagePath: string | null;
};

export const MAX_PRIZES = 20;
export const MAX_PRIZE_TITLE = 120;
export const MAX_PRIZE_QUANTITY = 100_000;

/*
 * Rutas de imagen aceptadas dentro del bucket público raffle-images:
 * las "prizes/…" son de subidas en preparación (staging) y las
 * "raffles/…" las que crea el flujo de la foto del premio mayor.
 */
const IMAGE_PATH_PATTERN =
  /^(prizes|raffles)\/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp)$/;

function coerceQuantity(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return 1;
  }

  return Number(value);
}

/** Valida y normaliza la lista que llega del navegador (camelCase). */
export function parseRafflePrizes(value: unknown): RafflePrize[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("La lista de premios no es válida.");
  }

  if (value.length > MAX_PRIZES) {
    throw new Error(`No se pueden registrar más de ${MAX_PRIZES} premios.`);
  }

  return value.map((raw, index) => {
    const position = index + 1;

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(`El premio ${position} no es válido.`);
    }

    const item = raw as Record<string, unknown>;

    const id = typeof item.id === "string" && item.id.trim().length > 0
      ? item.id.trim()
      : null;

    const title = typeof item.title === "string" ? item.title.trim() : "";

    if (title.length < 1) {
      throw new Error(`El premio ${position} necesita un nombre.`);
    }

    if (title.length > MAX_PRIZE_TITLE) {
      throw new Error(
        `El nombre del premio ${position} no puede superar los ${MAX_PRIZE_TITLE} caracteres.`,
      );
    }

    const quantity = coerceQuantity(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_PRIZE_QUANTITY
    ) {
      throw new Error(`La cantidad del premio ${position} no es válida.`);
    }

    const imagePath = parseImagePath(
      item.imagePath ?? item.image_path,
      `La foto del premio ${position}`,
    );

    return { id, title, quantity, imagePath };
  });
}

/** Ruta de la foto del premio mayor (o null). Reusa la misma validación. */
export function parseHeroImagePath(value: unknown): string | null {
  return parseImagePath(value, "La foto del premio");
}

function parseImagePath(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} no es válida.`);
  }

  const path = value.trim();

  if (path.length === 0) {
    return null;
  }

  if (path.length > 300 || !IMAGE_PATH_PATTERN.test(path)) {
    throw new Error(`${label} no es válida.`);
  }

  return path;
}

/*
 * Forma que espera el RPC (snake_case image_path). Un premio ya guardado
 * manda su id para conservarlo; uno nuevo lo omite y el backend
 * (assign_prize_ids) le asigna uno.
 */
export function prizesToDbJson(
  prizes: RafflePrize[],
): {
  id?: string;
  title: string;
  quantity: number;
  image_path: string | null;
}[] {
  return prizes.map((prize) => ({
    ...(prize.id ? { id: prize.id } : {}),
    title: prize.title,
    quantity: prize.quantity,
    image_path: prize.imagePath,
  }));
}

/** Lee raffles.prizes (Json de la base) a RafflePrize[] tolerando basura. */
export function prizesFromDbJson(value: unknown): RafflePrize[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: RafflePrize[] = [];

  for (const raw of value) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      continue;
    }

    const item = raw as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title : "";

    if (title.length === 0) {
      continue;
    }

    const id =
      typeof item.id === "string" && item.id.trim().length > 0
        ? item.id
        : null;

    const quantityValue =
      typeof item.quantity === "number"
        ? item.quantity
        : Number(item.quantity ?? 1);

    const quantity =
      Number.isFinite(quantityValue) && quantityValue >= 1
        ? Math.floor(quantityValue)
        : 1;

    const imagePath =
      typeof item.image_path === "string" && item.image_path.trim().length > 0
        ? item.image_path
        : null;

    result.push({ id, title, quantity, imagePath });
  }

  return result;
}
