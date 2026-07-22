"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type WinnerFormProps = {
  raffleId: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

export function WinnerForm({ raffleId }: WinnerFormProps) {
  const router = useRouter();

  const [ticketNumber, setTicketNumber] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const parsed = Number(ticketNumber);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Ingresa un número de ticket válido.");
      return;
    }

    if (!acknowledged) {
      setError("Debes confirmar que esta acción es irreversible.");
      return;
    }

    const confirmed = window.confirm(
      `Vas a registrar el ticket ${parsed} como GANADOR. Esta acción es única e IRREVERSIBLE. ¿Continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/raffles/${raffleId}/winner`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketNumber: parsed }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success) {
        throw new Error(
          body.error ?? "No se pudo registrar el ganador.",
        );
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div>
        <label
          htmlFor="ticketNumber"
          className="mb-2 block text-sm font-medium"
        >
          Número de ticket ganador
        </label>
        <input
          id="ticketNumber"
          type="number"
          inputMode="numeric"
          min={1}
          value={ticketNumber}
          onChange={(event) => setTicketNumber(event.target.value)}
          required
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-white outline-none focus:border-amber-500"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1"
        />
        <span>
          Confirmo que el ganador es único e irreversible y que el número es
          correcto.
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900 bg-red-950 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !acknowledged}
        className="rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Registrando..." : "Registrar ganador"}
      </button>
    </form>
  );
}
