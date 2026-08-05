import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Lectura de las reglas operativas que los documentos legales publican al
 * participante. Se leen de la base y no se escriben a mano en el texto
 * porque `reservation_minutes` es editable desde /admin/settings: un número
 * fijo en las bases quedaría desmentido por el sistema en cuanto el admin
 * lo cambie, y esas bases ya no llevan aviso de borrador.
 *
 * Tope de solicitudes pendientes por documento: es la constante
 * `c_max_pending_per_document` de create_purchase_request (ver migración
 * 20260727222740). No vive en app_settings, así que se declara aquí y debe
 * moverse junta con el SQL si alguna vez cambia.
 */
export const MAX_PENDING_REQUESTS_PER_DOCUMENT = 10;

/** Respaldo idéntico al de create_purchase_request si falta la fila. */
const DEFAULT_RESERVATION_MINUTES = 60;

export async function getReservationMinutes(): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("reservation_minutes")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el plazo de reserva: ${error.message}`,
    );
  }

  const minutes = data?.reservation_minutes;

  return typeof minutes === "number" && minutes > 0
    ? minutes
    : DEFAULT_RESERVATION_MINUTES;
}

/** "6 horas" / "90 minutos": redondea a horas solo cuando es exacto. */
export function formatReservationWindow(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }

  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}
