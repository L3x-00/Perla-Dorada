"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminInput, btnPrimary, btnSmall } from "@/components/admin/ui";

type PurchaseRequestPrintActionProps = {
  purchaseRequestId: string;
  ticketCount: number;
  /** true si al menos uno de los tickets ya tiene una impresión previa. */
  hasReprints: boolean;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  printableUrl?: string;
};

/*
 * Un solo botón imprime, en un único documento, TODOS los tickets activos
 * de la solicitud (ver register_purchase_request_ticket_prints). Sin
 * límite de reimpresiones: es uso interno del panel para las ánforas del
 * sorteo, no la reimpresión pública con tope. Si algún ticket ya se
 * imprimió antes, se pide un motivo — uno solo para toda la tanda.
 */
export function PurchaseRequestPrintAction({
  purchaseRequestId,
  ticketCount,
  hasReprints,
}: PurchaseRequestPrintActionProps) {
  const router = useRouter();

  const [showReasonForm, setShowReasonForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registerPrint() {
    const normalizedReason = reason.trim();

    if (hasReprints && normalizedReason.length < 3) {
      setError("Debes indicar un motivo de reimpresión.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/print`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: hasReprints ? normalizedReason : undefined,
          }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success || !body.printableUrl) {
        throw new Error(body.error ?? "No se pudo registrar la impresión.");
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

  const label = hasReprints
    ? `Reimprimir tickets (${ticketCount})`
    : `Imprimir tickets (${ticketCount})`;

  if (!hasReprints) {
    return (
      <div className="min-w-52 space-y-2">
        <button
          type="button"
          onClick={registerPrint}
          disabled={submitting}
          className={`${btnPrimary} ${btnSmall}`}
        >
          {submitting ? "Registrando..." : label}
        </button>

        {error ? <p className="max-w-xs text-xs text-red-400">{error}</p> : null}
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
          {label}
        </button>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={`reason-${purchaseRequestId}`}
            className="block text-xs font-medium text-muted"
          >
            Motivo de reimpresión (aplica a los {ticketCount} tickets)
          </label>

          <textarea
            id={`reason-${purchaseRequestId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={3}
            maxLength={500}
            disabled={submitting}
            placeholder="Ejemplo: el rollo original se dañó en la impresora"
            className={`${adminInput} text-xs`}
          />

          <p className="text-right text-xs text-muted">{reason.length}/500</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={registerPrint}
              disabled={submitting || reason.trim().length < 3}
              className="inline-flex items-center justify-center rounded-lg border border-amber-700/70 bg-amber-900/40 px-3 py-2 text-xs font-medium text-amber-100 transition-colors duration-200 hover:bg-amber-900/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Registrando..." : "Confirmar reimpresión"}
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

      {error ? <p className="max-w-xs text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
