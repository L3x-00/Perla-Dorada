"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TicketPrintActionProps = {
  ticketId: string;
  previousPrints: number;
  maxReprints: number;
};

type PrintResponse = {
  success?: boolean;
  printableUrl?: string;
  error?: string;
  print?: {
    ticket_id: string;
    ticket_number: number;
    print_id: string;
    print_type: "original" | "reprint";
    print_sequence: number;
    printed_at: string;
    reprints_used: number;
    max_reprints: number;
  };
};

export function TicketPrintAction({
  ticketId,
  previousPrints,
  maxReprints,
}: TicketPrintActionProps) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [showReasonForm, setShowReasonForm] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const isReprint = previousPrints > 0;

  const reprintsUsed = Math.max(
    previousPrints - 1,
    0,
  );

  const limitReached =
    isReprint && reprintsUsed >= maxReprints;

  async function registerPrint() {
    const normalizedReason = reason.trim();

    if (
      isReprint &&
      normalizedReason.length < 3
    ) {
      setError(
        "Debes indicar un motivo de reimpresión.",
      );
      return;
    }

    if (normalizedReason.length > 500) {
      setError(
        "El motivo no puede superar los 500 caracteres.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/tickets/${ticketId}/print`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: isReprint
              ? normalizedReason
              : undefined,
          }),
        },
      );

      const body =
        (await response.json()) as PrintResponse;

      if (
        !response.ok ||
        !body.success ||
        !body.printableUrl
      ) {
        throw new Error(
          body.error ??
            "No se pudo registrar la impresión.",
        );
      }

      const printableWindow = window.open(
        body.printableUrl,
        "_blank",
        "noopener,noreferrer",
      );

      if (!printableWindow) {
        setError(
          "La impresión fue registrada, pero el navegador bloqueó la nueva ventana. Habilita las ventanas emergentes.",
        );
      }

      setShowReasonForm(false);
      setReason("");

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

  if (limitReached) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-400">
          Límite alcanzado
        </p>

        <p className="text-xs text-neutral-400">
          Reimpresiones: {reprintsUsed}/
          {maxReprints}
        </p>
      </div>
    );
  }

  if (!isReprint) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={registerPrint}
          disabled={submitting}
          className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Registrando..."
            : "Imprimir original"}
        </button>

        {error ? (
          <p className="max-w-xs text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-64 space-y-2">
      {!showReasonForm ? (
        <button
          type="button"
          onClick={() => {
            setShowReasonForm(true);
            setError(null);
          }}
          disabled={submitting}
          className="rounded-lg border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reimprimir ({reprintsUsed}/
          {maxReprints})
        </button>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={`reason-${ticketId}`}
            className="block text-xs font-medium text-neutral-300"
          >
            Motivo de reimpresión
          </label>

          <textarea
            id={`reason-${ticketId}`}
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            rows={3}
            minLength={3}
            maxLength={500}
            disabled={submitting}
            placeholder="Ejemplo: el original se deterioró"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-sm text-white outline-none focus:border-amber-500"
          />

          <p className="text-right text-xs text-neutral-500">
            {reason.length}/500
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={registerPrint}
              disabled={
                submitting ||
                reason.trim().length < 3
              }
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Registrando..."
                : "Confirmar reimpresión"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowReasonForm(false);
                setReason("");
                setError(null);
              }}
              disabled={submitting}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="max-w-xs text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}