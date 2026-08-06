"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnPrimary, btnSmall } from "@/components/admin/ui";

type PurchaseRequestPrintActionProps = {
  purchaseRequestId: string;
  /** Acota la tanda a un único grupo solicitud + rifa. */
  raffleId: string;
  ticketCount: number;
  /** Cantidad de tickets vigentes con al menos una impresión previa. */
  printedTicketCount: number;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  code?: string;
  printableUrl?: string;
};

/*
 * Un solo botón imprime, en un único documento, TODOS los tickets activos
 * del grupo solicitud + rifa (ver register_ticket_group_prints). Sin límite
 * de reimpresiones: es uso interno del panel para las ánforas del sorteo.
 *
 * La reimpresión ya no pide escribir un motivo: el botón abre la hoja al
 * primer clic. Cuando la tanda incluye tickets ya impresos se envía un motivo
 * automático solo para conservar la traza (actor, fecha, secuencia y tipo);
 * la RPC no cambia.
 */
const AUTO_REPRINT_REASON = "Reimpresión administrativa";

export function PurchaseRequestPrintAction({
  purchaseRequestId,
  raffleId,
  ticketCount,
  printedTicketCount,
}: PurchaseRequestPrintActionProps) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRequired = printedTicketCount > 0;

  async function registerPrint() {
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
        `/api/admin/purchase-requests/${purchaseRequestId}/print`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reasonRequired ? AUTO_REPRINT_REASON : undefined,
            raffleId,
          }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success || !body.printableUrl) {
        printableWindow.close();
        throw new Error(body.error ?? "No se pudo registrar la impresión.");
      }

      printableWindow.location.replace(body.printableUrl);
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

  const newTicketCount = Math.max(ticketCount - printedTicketCount, 0);
  const label =
    printedTicketCount === 0
      ? `Imprimir tickets (${ticketCount})`
      : printedTicketCount === ticketCount
        ? `Reimprimir tickets (${ticketCount})`
        : `Imprimir ${newTicketCount} y reimprimir ${printedTicketCount}`;

  return (
    <div className="min-w-52 space-y-2">
      <button
        type="button"
        onClick={registerPrint}
        disabled={submitting}
        className={
          reasonRequired
            ? "inline-flex items-center justify-center rounded-lg border border-amber-800/70 bg-amber-950/25 px-3 py-2 text-xs font-medium text-amber-200 transition-colors duration-200 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-50"
            : `${btnPrimary} ${btnSmall}`
        }
      >
        {submitting ? "Registrando..." : label}
      </button>

      {error ? (
        <p role="alert" className="max-w-xs text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
