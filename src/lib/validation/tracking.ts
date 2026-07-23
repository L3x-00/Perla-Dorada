import { z } from "zod";

const DNI_PATTERN = /^[0-9A-Za-z-]{6,20}$/;
const TRACKING_CODE_PATTERN = /^[0-9A-Z-]{6,40}$/;

const stripSpaces = (value: string): string =>
  value.trim().replace(/\s+/g, "");

/*
 * Esquema compartido por las consultas públicas por DNI + código de
 * seguimiento (/api/tracking y /api/tickets). Normaliza antes de validar:
 * quita espacios y pasa el código a mayúsculas.
 */
export const trackingLookupSchema = z.object({
  dni: z
    .string({ message: "El DNI no es válido." })
    .transform(stripSpaces)
    .pipe(
      z.string().regex(DNI_PATTERN, "El DNI no es válido."),
    ),

  trackingCode: z
    .string({ message: "El código de seguimiento no es válido." })
    .transform((value) => stripSpaces(value).toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          TRACKING_CODE_PATTERN,
          "El código de seguimiento no es válido.",
        ),
    ),
});

export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>;
