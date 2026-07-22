import { z } from "zod";

const digitsOnly = (value: string): string =>
  value.replace(/\D/g, "");

export const purchaseRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Ingresa el nombre completo.")
    .max(150, "El nombre es demasiado largo."),

  dni: z
    .string()
    .transform(digitsOnly)
    .pipe(
      z
        .string()
        .length(8, "El DNI debe contener 8 dígitos."),
    ),

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
});

export type PurchaseRequestInput = z.infer<
  typeof purchaseRequestSchema
>;