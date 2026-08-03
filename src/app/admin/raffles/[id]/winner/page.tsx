import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { prizesFromDbJson } from "@/lib/raffles/prizes";
import { raffleImageUrl } from "@/lib/storage/public-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { WinnerForm } from "./winner-form";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

type ResolvedWinner = {
  ticketNumber: number | null;
  winnerName: string | null;
  winnerDni: string | null;
  winnerLocation: string | null;
  confirmedAt: string | null;
};

export default async function RaffleWinnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: raffle, error: raffleError } = await adminClient
    .from("raffles")
    .select("id, name, status, draw_at, prizes")
    .eq("id", id)
    .maybeSingle();

  if (raffleError) {
    console.error("Error loading raffle for winner registration:", raffleError);
    throw new Error("No se pudo cargar la rifa.");
  }

  if (!raffle) {
    notFound();
  }

  const prizes = prizesFromDbJson(raffle.prizes);

  const { data: winners, error: winnersError } = await adminClient
    .from("raffle_winners")
    .select("id, ticket_id, prize_id, prize_title, winner_location, confirmed_at")
    .eq("raffle_id", id);

  if (winnersError) {
    console.error("Error loading raffle winners:", winnersError);
    throw new Error("No se pudieron cargar los ganadores registrados.");
  }

  const winnerRows = winners ?? [];

  /*
   * Resuelve ticket -> número + participante en dos consultas en lote (no
   * una por ganador): esta página maneja como mucho MAX_PRIZES filas, pero
   * no hay razón para hacer N+1 pudiendo hacer 2.
   */
  const ticketIds = winnerRows.map((w) => w.ticket_id);
  const ticketsById = new Map<
    string,
    { ticket_number: number; purchase_request_id: string }
  >();

  if (ticketIds.length > 0) {
    const { data: tickets, error: ticketsError } = await adminClient
      .from("tickets")
      .select("id, ticket_number, purchase_request_id")
      .in("id", ticketIds);

    if (ticketsError) {
      console.error("Error loading winner tickets:", ticketsError);
      throw new Error("No se pudo cargar la información del ganador.");
    }

    for (const ticket of tickets ?? []) {
      ticketsById.set(ticket.id, ticket);
    }
  }

  const purchaseRequestIds = [...ticketsById.values()].map(
    (t) => t.purchase_request_id,
  );
  const purchasesById = new Map<string, { full_name: string; dni: string }>();

  if (purchaseRequestIds.length > 0) {
    const { data: purchases, error: purchasesError } = await adminClient
      .from("purchase_requests")
      .select("id, full_name, dni")
      .in("id", purchaseRequestIds);

    if (purchasesError) {
      console.error("Error loading winner participants:", purchasesError);
      throw new Error("No se pudo cargar la información del ganador.");
    }

    for (const purchase of purchases ?? []) {
      purchasesById.set(purchase.id, purchase);
    }
  }

  function resolve(winnerId: string | null): ResolvedWinner | null {
    const winner = winnerRows.find((w) => w.id === winnerId);

    if (!winner) {
      return null;
    }

    const ticket = ticketsById.get(winner.ticket_id);
    const purchase = ticket
      ? purchasesById.get(ticket.purchase_request_id)
      : undefined;

    return {
      ticketNumber: ticket?.ticket_number ?? null,
      winnerName: purchase?.full_name ?? null,
      winnerDni: purchase?.dni ?? null,
      winnerLocation: winner.winner_location,
      confirmedAt: formatDateTime(winner.confirmed_at),
    };
  }

  const winnerByPrizeId = new Map(
    winnerRows.filter((w) => w.prize_id !== null).map((w) => [w.prize_id, w.id]),
  );
  const noPrizeWinner = winnerRows.find((w) => w.prize_id === null);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header>
          <Link
            href="/admin/raffles"
            className="text-sm text-gold underline-offset-4 hover:underline"
          >
            ← Volver a rifas
          </Link>

          <h1 className="mt-3 font-display text-3xl font-light text-cream sm:text-4xl">
            Ganador{prizes.length > 1 ? "es" : ""}
          </h1>
          <p className="mt-2 text-sm text-muted">{raffle.name}</p>
        </header>

        {raffle.status !== "closed" ? (
          <section className="mt-8 max-w-md rounded-xl border border-line bg-ink-2 p-6 text-sm leading-relaxed text-muted">
            La rifa debe estar <strong className="text-cream">cerrada</strong>{" "}
            antes de registrar un ganador. Estado actual:{" "}
            <strong className="text-cream">{raffle.status}</strong>.
          </section>
        ) : prizes.length === 0 ? (
          <SinglePrizeSection
            raffleId={raffle.id}
            winner={noPrizeWinner ? resolve(noPrizeWinner.id) : null}
          />
        ) : (
          <div className="mt-8 space-y-5">
            <p className="text-sm leading-relaxed text-muted">
              Esta rifa tiene {prizes.length} premio
              {prizes.length === 1 ? "" : "s"}. Registra el ganador de cada
              uno por separado; cada registro es único e irreversible.
            </p>

            {prizes.map((prize) => {
              const winnerId = prize.id ? winnerByPrizeId.get(prize.id) : undefined;
              const resolved = winnerId ? resolve(winnerId) : null;

              return (
                <PrizeWinnerCard
                  key={prize.id ?? prize.title}
                  raffleId={raffle.id}
                  prizeId={prize.id}
                  prizeTitle={prize.title}
                  prizeQuantity={prize.quantity}
                  prizeImageUrl={raffleImageUrl(prize.imagePath)}
                  winner={resolved}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function SinglePrizeSection({
  raffleId,
  winner,
}: {
  raffleId: string;
  winner: ResolvedWinner | null;
}) {
  return winner ? (
    <WinnerSummary winner={winner} />
  ) : (
    <>
      <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
        Registra el número de ticket ganador de esta rifa cerrada. El
        registro es único e irreversible.
      </p>
      <WinnerForm raffleId={raffleId} prizeId={null} />
    </>
  );
}

function PrizeWinnerCard({
  raffleId,
  prizeId,
  prizeTitle,
  prizeQuantity,
  prizeImageUrl,
  winner,
}: {
  raffleId: string;
  prizeId: string | null;
  prizeTitle: string;
  prizeQuantity: number;
  prizeImageUrl: string | null;
  winner: ResolvedWinner | null;
}) {
  return (
    <section className="rounded-xl border border-line bg-ink-2 p-5">
      <div className="flex items-start gap-4">
        {prizeImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prizeImageUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-[0.6rem] uppercase tracking-widest text-muted">
            Sin foto
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-light text-cream">
            {prizeTitle}
          </p>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Cantidad descriptiva: {prizeQuantity}
          </p>
          <p className="mt-1 text-xs text-muted">
            Esta fila admite un solo ganador.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {winner ? (
          <WinnerSummary winner={winner} compact />
        ) : (
          <WinnerForm raffleId={raffleId} prizeId={prizeId} compact />
        )}
      </div>
    </section>
  );
}

function WinnerSummary({
  winner,
  compact = false,
}: {
  winner: ResolvedWinner;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-emerald-800/70 bg-emerald-950/25 ${
        compact ? "p-4" : "mt-8 max-w-md p-6"
      }`}
    >
      <p className="eyebrow text-emerald-300">
        Ganador registrado (irreversible)
      </p>

      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
        Ticket ganador
      </p>
      <p
        className={`mt-1.5 font-display font-light tabular-nums text-cream ${
          compact ? "text-4xl" : "text-6xl"
        }`}
      >
        {winner.ticketNumber !== null
          ? String(winner.ticketNumber).padStart(4, "0")
          : "—"}
      </p>

      {winner.winnerName ? (
        <p className="mt-4 text-sm text-muted">
          <span className="text-muted">Participante:</span>{" "}
          <span className="font-medium">{winner.winnerName}</span>
        </p>
      ) : null}

      {winner.winnerDni ? (
        <p className="mt-1.5 text-sm text-muted">
          <span className="text-muted">DNI:</span>{" "}
          <span className="font-medium">{winner.winnerDni}</span>
        </p>
      ) : null}

      {winner.winnerLocation ? (
        <p className="mt-1.5 text-sm text-muted">
          <span className="text-muted">Compra en:</span>{" "}
          <span className="font-medium">{winner.winnerLocation}</span>
        </p>
      ) : null}

      {winner.confirmedAt ? (
        <p className="mt-1.5 text-sm text-muted">
          <span className="text-muted">Confirmado:</span> {winner.confirmedAt}
        </p>
      ) : null}
    </section>
  );
}
