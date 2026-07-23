import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { WinnerForm } from "./winner-form";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function RaffleWinnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/admin/login");
  }

  const adminClient = createAdminClient();

  const { data: raffle } = await adminClient
    .from("raffles")
    .select("id, name, status, draw_at")
    .eq("id", id)
    .maybeSingle();

  if (!raffle) {
    notFound();
  }

  const { data: winner } = await adminClient
    .from("raffle_winners")
    .select("id, ticket_id, confirmed_at")
    .eq("raffle_id", id)
    .maybeSingle();

  let winningTicketNumber: number | null = null;
  let winnerName: string | null = null;
  let winnerDni: string | null = null;

  if (winner) {
    const { data: ticket } = await adminClient
      .from("tickets")
      .select("ticket_number, purchase_request_id")
      .eq("id", winner.ticket_id)
      .maybeSingle();

    winningTicketNumber = ticket?.ticket_number ?? null;

    if (ticket) {
      const { data: purchaseRequest } = await adminClient
        .from("purchase_requests")
        .select("full_name, dni")
        .eq("id", ticket.purchase_request_id)
        .maybeSingle();

      winnerName = purchaseRequest?.full_name ?? null;
      winnerDni = purchaseRequest?.dni ?? null;
    }
  }

  const confirmedAt = winner ? formatDateTime(winner.confirmed_at) : null;

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

          <h1 className="mt-3 font-display text-3xl font-light text-cream sm:text-4xl">Ganador</h1>
          <p className="mt-2 text-sm text-muted">{raffle.name}</p>
        </header>

        {winner ? (
          <section className="mt-8 max-w-md rounded-xl border border-emerald-800/70 bg-emerald-950/25 p-6">
            <p className="eyebrow text-emerald-300">
              Ganador registrado (irreversible)
            </p>

            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted">Ticket ganador</p>
            <p className="mt-2 font-display text-6xl font-light tabular-nums text-cream">
              {winningTicketNumber !== null
                ? String(winningTicketNumber).padStart(4, "0")
                : "—"}
            </p>

            {winnerName ? (
              <p className="mt-6 text-sm text-muted">
                <span className="text-muted">Participante:</span>{" "}
                <span className="font-medium">{winnerName}</span>
              </p>
            ) : null}

            {winnerDni ? (
              <p className="mt-1.5 text-sm text-muted">
                <span className="text-muted">DNI:</span>{" "}
                <span className="font-medium">{winnerDni}</span>
              </p>
            ) : null}

            {confirmedAt ? (
              <p className="mt-1.5 text-sm text-muted">
                <span className="text-muted">Confirmado:</span>{" "}
                {confirmedAt}
              </p>
            ) : null}
          </section>
        ) : raffle.status === "closed" ? (
          <>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
              Registra el número de ticket ganador de esta rifa cerrada. El
              registro es único e irreversible.
            </p>
            <WinnerForm raffleId={raffle.id} />
          </>
        ) : (
          <section className="mt-8 max-w-md rounded-xl border border-line bg-ink-2 p-6 text-sm leading-relaxed text-muted">
            La rifa debe estar <strong className="text-cream">cerrada</strong>{" "}
            antes de registrar un ganador. Estado actual:{" "}
            <strong className="text-cream">{raffle.status}</strong>.
          </section>
        )}
      </div>
    </main>
  );
}
