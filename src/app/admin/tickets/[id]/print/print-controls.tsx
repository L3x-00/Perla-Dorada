"use client";

import Script from "next/script";
import { useState } from "react";

import { PrintProfileSelector } from "@/components/printing/print-profile";
import { printUrnTickets, type UrnTicketPrintData } from "@/lib/printing/qz";

/*
 * Lee los tickets ya renderizados en la página
 */
function readRenderedTickets(): UrnTicketPrintData[] {
  const nodes = document.querySelectorAll<HTMLElement>(".urn-ticket-print");

  return Array.from(nodes).flatMap((node) => {
    const ticketCode = node
      .querySelector(".urn-ticket-receipt__code")
      ?.textContent?.trim();

    const purchasedAt = node
      .querySelector(".urn-ticket-receipt__date")
      ?.textContent?.trim();

    const fullName = node
      .querySelector(".urn-ticket-receipt__name")
      ?.textContent?.trim();

    const phone = node
      .querySelector(".urn-ticket-receipt__phone")
      ?.textContent?.trim();

    if (!ticketCode || !purchasedAt || !fullName || !phone) {
      return [];
    }

    return [{ ticketCode, purchasedAt, fullName, phone }];
  });
}

export function PrintControls() {
  const [qzStatus, setQzStatus] = useState<"idle" | "printing" | "error">("idle");
  const [qzError, setQzError] = useState<string | null>(null);

  async function printWithQZ() {
    const tickets = readRenderedTickets();

    if (tickets.length === 0) {
      setQzStatus("error");
      setQzError("No se encontraron tickets en esta página para imprimir.");
      return;
    }

    setQzStatus("printing");
    setQzError(null);

    try {
      // 🔥 CLAVE: UNA SOLA LLAMADA
      await printUrnTickets(tickets);

      setQzStatus("idle");
    } catch (error) {
      setQzStatus("error");
      setQzError(
        error instanceof Error
          ? error.message
          : "No se pudo imprimir con QZ Tray."
      );
    }
  }

  return (
    <div className="mx-auto mb-6 max-w-xl space-y-3 print:hidden">
      <Script
        src="https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js"
        strategy="lazyOnload"
      />

      <PrintProfileSelector />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-cream"
        >
          Imprimir
        </button>

        <button
          type="button"
          onClick={() => void printWithQZ()}
          disabled={qzStatus === "printing"}
          className="rounded-lg border border-black px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {qzStatus === "printing" ? "Imprimiendo..." : "Imprimir PRO"}
        </button>

        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-black"
        >
          Cerrar
        </button>
      </div>

      <p className="text-xs leading-relaxed text-neutral-600">
        Elige la impresora en el diálogo del navegador. Cada ticket conserva
        su propia página, corte y cambiar el formato no registra otra
        reimpresión.
      </p>

      <p className="text-xs leading-relaxed text-neutral-600">
        &quot;Imprimir PRO&quot; envía cada ticket directo a la impresora
        térmica por QZ Tray (ESC/POS), sin el diálogo ni los márgenes del
        navegador. Requiere tener QZ Tray abierto en este equipo.
      </p>

      {qzStatus === "error" && qzError ? (
        <p role="alert" className="text-xs leading-relaxed text-red-700">
          {qzError}
        </p>
      ) : null}
    </div>
  );
}
