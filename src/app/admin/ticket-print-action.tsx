"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TicketPrintActionProps = {
  ticketId: string;
  previousPrints: number;
  printEndpoint?: string;
};

type PrintResponse = {
  success?: boolean;
  printableUrl?: string;
  error?: string;
  code?: string;
  print?: {
    ticket_id: string;
    ticket_number: number;
    print_id: string;
    print_type: "original" | "reprint";
    print_sequence: number;
    printed_at: string;
    reprints_used: number;
    max_reprints: number | null;
  };
};

export function TicketPrintAction({
  ticketId,
  previousPrints,
  printEndpoint,
}: TicketPrintActionProps) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [showReasonForm, setShowReasonForm] =
    useState(false);
  const [serverRequiresReason, setServerRequiresReason] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const isReprint = previousPrints > 0 || serverRequiresReason;

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

    const printableWindow = window.open("about:blank", "_blank");

    if (!printableWindow) {
      setError(
        "El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo nuevamente.",
      );
      return;
    }

    printableWindow.opener = null;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        printEndpoint ?? `/api/admin/tickets/${ticketId}/print`,
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
        printableWindow.close();

        if (body.code === "REPRINT_REASON_REQUIRED") {
          setServerRequiresReason(true);
          setShowReasonForm(true);
          router.refresh();
        }

        throw new Error(
          body.error ??
            "No se pudo registrar la impresión.",
        );
      }

      printableWindow.location.replace(body.printableUrl);

      setShowReasonForm(false);
      setReason("");

      router.refresh();
    } catch (caughtError) {
      if (
        !printableWindow.closed &&
        printableWindow.location.href === "about:blank"
      ) {
        printableWindow.close();
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReprint) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={registerPrint}
          disabled={submitting}
          className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Registrando..."
            : "Imprimir original"}
        </button>

        {error ? (
          <p role="alert" className="max-w-xs text-xs text-red-400">
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
          className="inline-flex items-center justify-center rounded-lg border border-amber-800/70 bg-amber-950/25 px-3 py-2 text-xs font-medium text-amber-200 transition-colors duration-200 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reimprimir
        </button>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={`reason-${ticketId}`}
            className="block text-xs font-medium text-muted"
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
            className="w-full rounded-lg border border-line bg-ink p-2 text-sm text-cream outline-none focus:border-gold"
          />

          <p className="text-right text-xs text-muted">
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
              className="inline-flex items-center justify-center rounded-lg border border-amber-700/70 bg-amber-900/40 px-3 py-2 text-xs font-medium text-amber-100 transition-colors duration-200 hover:bg-amber-900/70 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-lg border border-line px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="max-w-xs text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
