import { z } from "zod";

import { MAX_TICKETS_PER_PURCHASE_REQUEST } from "@/config/purchase";
import {
  DOCUMENT_TYPES,
  normalizeDocumentNumber,
  validateDocumentNumber,
} from "@/lib/validation/document";

const digitsOnly = (value: string): string =>
  value.replace(/\D/g, "");

export const purchaseRequestSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Ingresa tus nombres.")
      .max(74, "Los nombres son demasiado largos."),

    lastName: z
      .string()
      .trim()
      .min(2, "Ingresa tus apellidos.")
      .max(74, "Los apellidos son demasiado largos."),

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
      .positive("La cantidad debe ser mayor que cero.")
      .max(
        MAX_TICKETS_PER_PURCHASE_REQUEST,
        `Puedes solicitar como máximo ${MAX_TICKETS_PER_PURCHASE_REQUEST} boletos por operación.`,
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
  })
  /*
   * La columna histÃ³rica se llama full_name. Componerla aquÃ­ permite pedir
   * nombres y apellidos por separado sin romper tickets, consultas ni datos
   * ya emitidos.
   */
  .transform(({ firstName, lastName, ...value }) => ({
    ...value,
    fullName: `${firstName} ${lastName}`,
  }));

export type PurchaseRequestInput = z.infer<
  typeof purchaseRequestSchema
>;
