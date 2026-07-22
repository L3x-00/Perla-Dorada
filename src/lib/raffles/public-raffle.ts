import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Lectura pública de la rifa activa.
 *
 * La disponibilidad que se devuelve aquí es SOLO para presentación en el
 * portal público. La validación autoritativa de disponibilidad y de la
 * reserva se realiza de forma transaccional dentro de create_purchase_request()
 * al momento de enviar la solicitud; esta función nunca decide el resultado.
 *
 * Usa el cliente de servicio (service_role) porque todas las tablas tienen
 * RLS cerrado con REVOKE ALL; por eso este módulo es server-only y jamás debe
 * importarse desde un Client Component.
 */

export type ActivePublicRaffle = {
  name: string;
  description: string | null;
  ticketPrice: number;
  drawAt: string | null;
  closesAt: string | null;
  available: number;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
};

export async function getActivePublicRaffle(): Promise<ActivePublicRaffle | null> {
  const supabase = createAdminClient();

  const { data: settings, error: settingsError } = await supabase
    .from("app_settings")
    .select("maintenance_mode, maintenance_message")
    .eq("id", true)
    .maybeSingle();

  if (settingsError) {
    throw new Error(
      `No se pudo consultar la configuración: ${settingsError.message}`,
    );
  }

  const maintenanceMode = settings?.maintenance_mode ?? false;
  const maintenanceMessage = settings?.maintenance_message ?? null;

  const { data: raffle, error: raffleError } = await supabase
    .from("raffles")
    .select(
      "id, name, description, ticket_price, total_tickets, draw_at, closes_at",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (raffleError) {
    throw new Error(
      `No se pudo consultar la rifa activa: ${raffleError.message}`,
    );
  }

  if (!raffle) {
    return null;
  }

  const { count: soldCount, error: soldError } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("raffle_id", raffle.id);

  if (soldError) {
    throw new Error(
      `No se pudo calcular la disponibilidad: ${soldError.message}`,
    );
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("purchase_requests")
    .select("requested_quantity")
    .eq("raffle_id", raffle.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (pendingError) {
    throw new Error(
      `No se pudo calcular la disponibilidad: ${pendingError.message}`,
    );
  }

  const reserved = (pendingRows ?? []).reduce(
    (sum, row) => sum + row.requested_quantity,
    0,
  );

  const available = Math.max(
    raffle.total_tickets - (soldCount ?? 0) - reserved,
    0,
  );

  return {
    name: raffle.name,
    description: raffle.description,
    ticketPrice: raffle.ticket_price,
    drawAt: raffle.draw_at,
    closesAt: raffle.closes_at,
    available,
    maintenanceMode,
    maintenanceMessage,
  };
}
