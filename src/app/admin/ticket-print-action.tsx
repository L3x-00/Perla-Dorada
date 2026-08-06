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

/*
 * Reimpresión sin fricción: el botón imprime directamente, tanto el original
 * como las reimpresiones. Ya no se pide escribir un motivo a mano — abre la
 * hoja de impresión al primer clic. Las reimpresiones envían un motivo
 * automático solo para conservar la traza en ticket_prints (actor, fecha,
 * secuencia y tipo); la RPC no cambia.
 */
const AUTO_REPRINT_REASON = "Reimpresión administrativa";

export function TicketPrintAction({
  ticketId,
  previousPrints,
  printEndpoint,
}: TicketPrintActionProps) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReprint = previousPrints > 0;

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
        printEndpoint ?? `/api/admin/tickets/${ticketId}/print`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: isReprint ? AUTO_REPRINT_REASON : undefined,
          }),
        },
      );

      const body = (await response.json()) as PrintResponse;

      if (!response.ok || !body.success || !body.printableUrl) {
        printableWindow.close();

        throw new Error(
          body.error ?? "No se pudo registrar la impresión.",
        );
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={registerPrint}
        disabled={submitting}
        className={
          isReprint
            ? "inline-flex items-center justify-center rounded-lg border border-amber-800/70 bg-amber-950/25 px-3 py-2 text-xs font-medium text-amber-200 transition-colors duration-200 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-50"
            : "rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {submitting
          ? "Registrando..."
          : isReprint
            ? "Reimprimir"
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
