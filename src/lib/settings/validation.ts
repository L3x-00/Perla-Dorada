import { z } from "zod";

/*
 * Rangos operativos seguros para la configuración pública.
 *
 * La base de datos (app_settings) impone además sus propios CHECK:
 *   reservation_minutes > 0
 * El campo histórico max_reprints ya no limita las impresiones del panel.
 */
export const RESERVATION_MINUTES_MIN = 5;
export const RESERVATION_MINUTES_MAX = 1440;
export const MAINTENANCE_MESSAGE_MAX = 500;

export const appSettingsSchema = z.object({
  maintenanceMode: z.boolean({
    message: "El modo mantenimiento debe ser verdadero o falso.",
  }),

  reservationMinutes: z.coerce
    .number()
    .int("Los minutos de reserva deben ser un número entero.")
    .min(
      RESERVATION_MINUTES_MIN,
      `La reserva no puede ser menor a ${RESERVATION_MINUTES_MIN} minutos.`,
    )
    .max(
      RESERVATION_MINUTES_MAX,
      `La reserva no puede superar los ${RESERVATION_MINUTES_MAX} minutos.`,
    ),

  maintenanceMessage: z
    .string()
    .max(
      MAINTENANCE_MESSAGE_MAX,
      `El mensaje de mantenimiento no puede superar los ${MAINTENANCE_MESSAGE_MAX} caracteres.`,
    )
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
