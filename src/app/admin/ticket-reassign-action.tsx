"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnPrimary, btnSmall } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type ActiveRaffle = {
  id: string;
  name: string;
};

type ReassignResponse = {
  error?: string;
  success?: boolean;
};

export function TicketReassignAction({
  ticketId,
  activeRaffles,
}: {
  ticketId: string;
  activeRaffles: ActiveRaffle[];
}) {
  const router = useRouter();
  const [targetRaffleId, setTargetRaffleId] = useState(
    activeRaffles[0]?.id ?? "",
  );
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetRaffle = activeRaffles.find(
    (raffle) => raffle.id === targetRaffleId,
  );

  async function reassignTicket() {
    if (!targetRaffle || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}/reassign`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRaffleId }),
      });
      const body = (await response.json()) as ReassignResponse;

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "No se pudo reasignar el ticket.");
      }

      setConfirming(false);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (activeRaffles.length === 0) {
    return (
      <p className="max-w-xs text-xs text-amber-300">
        Ticket congelado. Activa una nueva rifa para poder reasignarlo.
      </p>
    );
  }

  return (
    <div className="min-w-56 space-y-2">
      <label htmlFor={`target-raffle-${ticketId}`} className="sr-only">
        Nueva rifa
      </label>
      <select
        id={`target-raffle-${ticketId}`}
        value={targetRaffleId}
        onChange={(event) => setTargetRaffleId(event.target.value)}
        disabled={submitting}
        className="w-full rounded-lg border border-line bg-ink px-2.5 py-2 text-xs text-cream outline-none focus:border-gold disabled:opacity-50"
      >
        {activeRaffles.map((raffle) => (
          <option key={raffle.id} value={raffle.id}>
            {raffle.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={!targetRaffleId || submitting}
        onClick={() => setConfirming(true)}
        className={`${btnPrimary} ${btnSmall} w-full`}
      >
        Reasignar a esta rifa
      </button>

      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Reasignar ticket congelado"
        description={
          targetRaffle
            ? `Se creará un nuevo ticket activo en "${targetRaffle.name}". El ticket original quedará como historial y no volverá a ser válido.`
            : "Selecciona una rifa activa."
        }
        confirmLabel="Sí, reasignar"
        busy={submitting}
        onConfirm={() => void reassignTicket()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
