"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  adminInput,
  adminLabel,
  btnPrimary,
} from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type WinnerFormProps = {
  raffleId: string;
  /** null = la rifa no desglosa premios (ganador único de la rifa). */
  prizeId: string | null;
  /** Versión reducida para usarse dentro de una tarjeta de premio. */
  compact?: boolean;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

export function WinnerForm({ raffleId, prizeId, compact = false }: WinnerFormProps) {
  const router = useRouter();

  const [ticketNumber, setTicketNumber] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTicketNumber, setConfirmTicketNumber] = useState<number | null>(
    null,
  );
  const [location, setLocation] = useState("");

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

    if (location.trim().length < 2) {
      setError("Indica la ciudad o distrito donde se realizó la compra.");
      return;
    }

    setConfirmTicketNumber(parsed);
  }

  async function registerWinner(ticketNumberToRegister: number) {
    const normalizedLocation = location.trim().replace(/\s+/g, " ");

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/raffles/${raffleId}/winner`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketNumber: ticketNumberToRegister,
            prizeId,
            location: normalizedLocation,
          }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success) {
        throw new Error(
          body.error ?? "No se pudo registrar el ganador.",
        );
      }

      setConfirmTicketNumber(null);
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

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "space-y-4"
          : "mt-6 max-w-md space-y-5 rounded-xl border border-line bg-ink-2 p-6"
      }
    >
      <div>
        <label
          htmlFor={`ticketNumber-${prizeId ?? "single"}`}
          className={adminLabel}
        >
          Número de ticket ganador
        </label>
        <input
          id={`ticketNumber-${prizeId ?? "single"}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={ticketNumber}
          onChange={(event) => setTicketNumber(event.target.value)}
          required
          disabled={submitting}
          className={adminInput}
        />
      </div>

      <div>
        <label
          htmlFor={`winner-location-${prizeId ?? "single"}`}
          className={adminLabel}
        >
          Ciudad o distrito de compra
        </label>
        <input
          id={`winner-location-${prizeId ?? "single"}`}
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          minLength={2}
          maxLength={120}
          required
          disabled={submitting}
          placeholder="Ejemplo: Miraflores, Lima"
          className={adminInput}
        />
        <p className="mt-1.5 text-xs text-muted">
          Se mostrará públicamente como referencia, sin dirección exacta.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-muted">
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
          className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !acknowledged}
        className={btnPrimary}
      >
        {submitting ? "Registrando..." : "Registrar ganador"}
      </button>

      <ConfirmDialog
        open={confirmTicketNumber !== null}
        tone="success"
        title="Confirmar ganador"
        description={`Registrarás el ticket ${
          confirmTicketNumber === null
            ? ""
            : String(confirmTicketNumber).padStart(4, "0")
        } como ganador. Esta acción es única e irreversible.`}
        confirmLabel="Sí, registrar ganador"
        busy={submitting}
        onConfirm={() => {
          if (confirmTicketNumber !== null) {
            void registerWinner(confirmTicketNumber);
          }
        }}
        onCancel={() => setConfirmTicketNumber(null)}
      />
    </form>
  );
}
