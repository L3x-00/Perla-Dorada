import { z } from "zod";

export const PROMOTION_TITLE_MAX = 150;
export const PROMOTION_DESCRIPTION_MAX = 500;
export const PROMOTION_CTA_TEXT_MAX = 40;
export const PROMOTION_CTA_URL_MAX = 2000;

/*
 * Acepta enlaces absolutos (https://...) o rutas internas (/#sorteo,
 * /legal/terminos): el slide del carrusel usa <Link> para las segundas y
 * <a target="_blank"> para las primeras (ver promo-slide.tsx).
 */
function isValidCtaUrl(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("#")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const isoDateOrNull = z
  .string()
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || !Number.isNaN(new Date(value).getTime()),
    { message: "La fecha no es válida." },
  );

export const promotionInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres.")
      .max(
        PROMOTION_TITLE_MAX,
        `El título no puede superar los ${PROMOTION_TITLE_MAX} caracteres.`,
      ),

    description: z
      .string()
      .trim()
      .max(
        PROMOTION_DESCRIPTION_MAX,
        `La descripción no puede superar los ${PROMOTION_DESCRIPTION_MAX} caracteres.`,
      )
      .default(""),

    ctaText: z
      .string()
      .trim()
      .min(1, "El texto del botón es obligatorio.")
      .max(
        PROMOTION_CTA_TEXT_MAX,
        `El texto del botón no puede superar los ${PROMOTION_CTA_TEXT_MAX} caracteres.`,
      ),

    imagePath: z.string().trim().max(400).nullable().default(null),

    ctaKind: z.enum(["raffle", "url"], {
      message: "Elige un tipo de enlace válido.",
    }),

    ctaRaffleId: z
      .string()
      .uuid("Selecciona un sorteo válido.")
      .nullable()
      .default(null),

    ctaUrl: z
      .string()
      .trim()
      .max(
        PROMOTION_CTA_URL_MAX,
        `El enlace no puede superar los ${PROMOTION_CTA_URL_MAX} caracteres.`,
      )
      .nullable()
      .default(null),

    startsAt: isoDateOrNull,
    endsAt: isoDateOrNull,

    enabled: z.boolean().default(true),
    displayOrder: z.coerce.number().int().default(0),
  })
  .superRefine((value, ctx) => {
    if (value.ctaKind === "raffle") {
      if (!value.ctaRaffleId) {
        ctx.addIssue({
          code: "custom",
          path: ["ctaRaffleId"],
          message: "Selecciona a qué sorteo redirige el enlace.",
        });
      }
    } else if (!value.ctaUrl || !isValidCtaUrl(value.ctaUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaUrl"],
        message:
          "Ingresa un enlace válido: una URL completa (https://...) o una ruta interna (/...).",
      });
    }

    if (
      value.startsAt &&
      value.endsAt &&
      new Date(value.endsAt).getTime() < new Date(value.startsAt).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La fecha de fin debe ser posterior a la de inicio.",
      });
    }
  });

export type PromotionInput = z.infer<typeof promotionInputSchema>;
