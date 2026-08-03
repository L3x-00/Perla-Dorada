import { z } from "zod";

import {
  DOCUMENT_TYPES,
  normalizeDocumentNumber,
  normalizeTrackingCode,
  validateDocumentNumber,
  validateTrackingCode,
} from "@/lib/validation/document";

/*
 * Esquema compartido por las consultas públicas por documento
 * (/api/tracking y /api/tickets). Normaliza antes de validar, igual que lo
 * hace normalize_document_number() en PostgreSQL, para que ambos lados de
 * la comparación se escriban igual.
 *
 * La consulta exige documento y código de seguimiento. `documentType` solo
 * sirve para exigir el formato correcto antes de consultar la información
 * agrupada del participante.
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
      .transform(normalizeTrackingCode),
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

    const trackingMessage = validateTrackingCode(value.trackingCode);

    if (trackingMessage) {
      ctx.addIssue({
        code: "custom",
        message: trackingMessage,
        path: ["trackingCode"],
      });
    }
  });

export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>;
