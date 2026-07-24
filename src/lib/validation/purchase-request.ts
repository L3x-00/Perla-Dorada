import { z } from "zod";

import {
  DOCUMENT_TYPES,
  normalizeDocumentNumber,
  validateDocumentNumber,
} from "@/lib/validation/document";

const digitsOnly = (value: string): string =>
  value.replace(/\D/g, "");

export const purchaseRequestSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Ingresa el nombre completo.")
      .max(150, "El nombre es demasiado largo."),

    documentType: z.enum(DOCUMENT_TYPES, {
      message: "Selecciona el tipo de documento.",
    }),

    /*
     * El formato depende de documentType, así que aquí solo se normaliza:
     * la comprobación real está en el superRefine de abajo.
     */
    dni: z.string().transform(normalizeDocumentNumber),

    phone: z
      .string()
      .transform(digitsOnly)
      .pipe(
        z
          .string()
          .min(7, "El teléfono no es válido.")
          .max(15, "El teléfono no es válido."),
      ),

    whatsapp: z
      .string()
      .transform(digitsOnly)
      .pipe(
        z
          .string()
          .min(7, "El WhatsApp no es válido.")
          .max(15, "El WhatsApp no es válido."),
      ),

    requestedQuantity: z.coerce
      .number()
      .int("La cantidad debe ser un número entero.")
      .positive("La cantidad debe ser mayor que cero."),
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

export type PurchaseRequestInput = z.infer<
  typeof purchaseRequestSchema
>;
