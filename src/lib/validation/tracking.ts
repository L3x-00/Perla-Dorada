import { z } from "zod";

import {
  DOCUMENT_TYPES,
  normalizeDocumentNumber,
  normalizeTrackingCode,
  validateDocumentNumber,
} from "@/lib/validation/document";

const TRACKING_CODE_PATTERN = /^[0-9A-Z]{6,40}$/;

/*
 * Esquema compartido por las consultas públicas por documento + código de
 * seguimiento (/api/tracking y /api/tickets). Normaliza antes de validar,
 * igual que lo hacen normalize_document_number() y
 * normalize_tracking_code() en PostgreSQL, para que ambos lados de la
 * comparación se escriban igual.
 *
 * `documentType` es opcional y por defecto 'dni': solo sirve para exigir el
 * formato correcto. La búsqueda en la base compara el número normalizado
 * sin mirar el tipo, así que equivocarse de tipo no impide encontrar la
 * solicitud mientras el número sea válido.
 */
export const trackingLookupSchema = z
  .object({
    documentType: z
      .enum(DOCUMENT_TYPES, {
        message: "El tipo de documento no es válido.",
      })
      .default("dni"),

    dni: z
      .string({ message: "El documento no es válido." })
      .transform(normalizeDocumentNumber),

    trackingCode: z
      .string({ message: "El código de seguimiento no es válido." })
      .transform(normalizeTrackingCode)
      .pipe(
        z
          .string()
          .regex(
            TRACKING_CODE_PATTERN,
            "El código de seguimiento no es válido.",
          ),
      ),
  })
  .superRefine((value, ctx) => {
    const message = validateDocumentNumber(
      value.documentType,
      value.dni,
    );

    if (message) {
      ctx.addIssue({
        code: "custom",
        message,
        path: ["dni"],
      });
    }
  });

export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>;
