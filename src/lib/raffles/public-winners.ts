import "server-only";

import { raffleImageUrl } from "@/lib/storage/public-url";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicRaffleWinnerEntry = {
  prizeId: string | null;
  prizeTitle: string;
  prizeImageUrl: string | null;
  ticketNumber: number;
  winnerDisplayName: string;
};

export type PublicRaffleWinners = {
  raffleId: string;
  raffleName: string;
  drawAt: string | null;
  winners: PublicRaffleWinnerEntry[];
};

/*
 * "Juan Pérez García" -> "Juan P." — primer nombre completo + inicial del
 * primer apellido. Nunca se expone el nombre completo ni el DNI en el
 * sitio público (a diferencia del panel admin).
 */
function maskWinnerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "Participante";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

/*
 * Ganadores de la última rifa cerrada que ya tiene al menos un ganador
 * registrado. Reemplaza la sección del sorteo en la portada mientras no
 * haya una rifa activa (DEC-04 revertida a propósito: antes el ganador
 * nunca se mostraba públicamente).
 */
export async function getLatestClosedRaffleWinners(): Promise<PublicRaffleWinners | null> {
  const supabase = createAdminClient();

  const { data: candidates, error: raffleError } = await supabase
    .from("raffles")
    .select(
      "id, name, image_path, draw_at, closed_at, raffle_winners(id, ticket_id, prize_id, prize_title, prize_image_path)",
    )
    .eq("status", "closed")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .limit(5);

  if (raffleError) {
    console.error("Error cargando rifas cerradas:", raffleError);
    return null;
  }

  const raffle = (candidates ?? []).find(
    (candidate) => candidate.raffle_winners.length > 0,
  );

  if (!raffle) {
    return null;
  }

  const ticketIds = raffle.raffle_winners.map((w) => w.ticket_id);

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, ticket_number, purchase_request_id")
    .in("id", ticketIds);

  const ticketsById = new Map((tickets ?? []).map((t) => [t.id, t]));

  const purchaseRequestIds = [...ticketsById.values()].map(
    (t) => t.purchase_request_id,
  );

  const { data: purchases } = await supabase
    .from("purchase_requests")
    .select("id, full_name")
    .in("id", purchaseRequestIds);

  const purchasesById = new Map((purchases ?? []).map((p) => [p.id, p]));

  const winners: PublicRaffleWinnerEntry[] = raffle.raffle_winners
    .map((winner) => {
      const ticket = ticketsById.get(winner.ticket_id);

      if (!ticket) {
        return null;
      }

      const purchase = purchasesById.get(ticket.purchase_request_id);

      return {
        prizeId: winner.prize_id,
        prizeTitle: winner.prize_id ? (winner.prize_title ?? "Premio") : raffle.name,
        prizeImageUrl: winner.prize_id
          ? raffleImageUrl(winner.prize_image_path)
          : raffleImageUrl(raffle.image_path),
        ticketNumber: ticket.ticket_number,
        winnerDisplayName: purchase ? maskWinnerName(purchase.full_name) : "Participante",
      };
    })
    .filter((entry): entry is PublicRaffleWinnerEntry => entry !== null)
    .sort((a, b) => a.ticketNumber - b.ticketNumber);

  if (winners.length === 0) {
    return null;
  }

  return {
    raffleId: raffle.id,
    raffleName: raffle.name,
    drawAt: raffle.draw_at,
    winners,
  };
}
