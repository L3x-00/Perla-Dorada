import "server-only";

import { PUBLIC_RAFFLE_CHANNEL } from "@/lib/realtime/channels";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Avisa al portal público que algo en las rifas cambió (creación, activación,
 * edición, cierre, cancelación o borrado), para que refresque en vivo.
 *
 * Es solo una señal (broadcast sin filas de tabla adjuntas) — el mismo
 * principio de "Realtime es solo informativo" que ya rige el resto del
 * proyecto: quien la recibe nunca confía en el payload, siempre vuelve a
 * consultar el servidor. Un fallo al emitirla no debe romper la operación
 * admin que la origina, así que se traga el error y solo lo registra.
 */
export async function broadcastPublicRaffleChange(): Promise<void> {
  try {
    const client = createAdminClient();
    await client.channel(PUBLIC_RAFFLE_CHANNEL).send({
      type: "broadcast",
      event: "changed",
      payload: {},
    });
  } catch (error) {
    console.error("No se pudo emitir el evento realtime de rifas:", error);
  }
}
