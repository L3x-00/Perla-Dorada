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
 * Solo pide el documento: la consulta ya no exige código de seguimiento
 * (decisión de producto, ver docs/contex/errores.md). `documentType` es
 * opcional y por defecto 'dni', y solo sirve para exigir el formato
 * correcto: la búsqueda compara el número normalizado sin mirar el tipo.
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
