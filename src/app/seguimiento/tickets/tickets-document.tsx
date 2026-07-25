"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { BrandLogo } from "@/components/site/brand-logo";
import { DocumentField } from "@/components/site/document-field";
import { formatDateTime } from "@/lib/format";
import type { DocumentType } from "@/lib/validation/document";

type Purchase = {
  requestId: string;
  raffleName: string;
  purchasedAt: string | null;
  ticketNumbers: number[];
};

type TicketsPayload = {
  fullName: string;
  dni: string;
  purchases: Purchase[];
};

type ApiResponse = TicketsPayload & {
  error?: string;
};

type FlatTicket = {
  raffleName: string;
  purchasedAt: string | null;
  ticketNumber: number;
};

/*
 * Clave de traspaso desde la consulta de estado (/seguimiento). Si el
 * usuario ya buscó su solicitud allí, llega con el DNI guardado y no se lo
 * volvemos a pedir: se cargan los tickets directo.
 */
const LOOKUP_KEY = "pd:ticket-lookup";

export function TicketsDocument() {
  const [documentType, setDocumentType] = useState<DocumentType>("dni");
  const [documentNumber, setDocumentNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TicketsPayload | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  const fetchDocument = useCallback(async (dt: DocumentType, dni: string) => {
    setSubmitting(true);
    setError(null);
    setPayload(null);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: dt, dni }),
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.purchases) {
        throw new Error(body.error ?? "No se pudo obtener los tickets.");
      }

      setPayload(body);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  /* Carga automática si venimos de la consulta de estado. */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(LOOKUP_KEY);
      sessionStorage.removeItem(LOOKUP_KEY);
    } catch {
      return;
    }

    if (!raw) {
      return;
    }

    let parsed: { documentType?: unknown; documentNumber?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const dni =
      typeof parsed.documentNumber === "string" ? parsed.documentNumber : "";
    const dt: DocumentType = parsed.documentType === "cui" ? "cui" : "dni";

    if (!dni) {
      return;
    }

    /*
     * El init va dentro de una función asíncrona a propósito: evita disparar
     * setState de forma síncrona dentro del efecto (cascada de renders) y
     * deja la carga como una tarea diferida.
     */
    async function autoLoad() {
      setDocumentType(dt);
      setDocumentNumber(dni);
      setAutoLoading(true);
      try {
        await fetchDocument(dt, dni);
      } finally {
        setAutoLoading(false);
      }
    }

    void autoLoad();
  }, [fetchDocument]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    await fetchDocument(documentType, documentNumber);
  }

  return (
    <div className="px-6 pt-32 pb-24 print:bg-white print:p-0 print:pt-0">
      {payload ? (
        <TicketStack payload={payload} onReset={() => setPayload(null)} />
      ) : autoLoading ? (
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm text-muted">Cargando tus tickets…</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          <header className="mb-8 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              Joyería Perla Dorada
            </p>
            <Link
              href="/seguimiento"
              className="text-sm font-medium text-gold underline-offset-4 hover:underline"
            >
              Ver estado
            </Link>
          </header>

          <h1 className="font-display text-3xl font-light text-cream">
            Descargar mis tickets
          </h1>
          <p className="mt-2 text-sm text-muted">
            Disponible solo para solicitudes aprobadas. Ingresa tu documento y
            verás todos tus tickets, de todas tus compras.
          </p>

          <form
            onSubmit={submit}
            className="mt-6 space-y-5 rounded-2xl border border-line bg-ink-2 p-6"
          >
            <DocumentField
              idPrefix="tickets"
              documentType={documentType}
              onDocumentTypeChange={setDocumentType}
              value={documentNumber}
              onValueChange={setDocumentNumber}
              showHint={false}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-gold px-4 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Buscando..." : "Ver mis tickets"}
            </button>
          </form>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TicketStack({
  payload,
  onReset,
}: {
  payload: TicketsPayload;
  onReset: () => void;
}) {
  /*
   * Un mismo documento puede tener varias compras aprobadas (en la misma
   * rifa o en rifas distintas): se aplanan a una sola lista de tickets,
   * cada uno con el nombre y la fecha de SU compra.
   */
  const tickets: FlatTicket[] = payload.purchases.flatMap((purchase) =>
    purchase.ticketNumbers.map((ticketNumber) => ({
      raffleName: purchase.raffleName,
      purchasedAt: formatDateTime(purchase.purchasedAt),
      ticketNumber,
    })),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-light text-cream">
              {tickets.length === 1 ? "Tu ticket" : `Tus ${tickets.length} tickets`}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Cada ticket se imprime en su propia hoja. Usa Guardar como PDF
              para descargarlos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
            >
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              Buscar otra
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 print:space-y-0">
        {tickets.map((ticket) => (
          <TicketCard
            key={`${ticket.raffleName}-${ticket.ticketNumber}`}
            raffleName={ticket.raffleName}
            fullName={payload.fullName}
            dni={payload.dni}
            purchasedAt={ticket.purchasedAt}
            ticketNumber={ticket.ticketNumber}
          />
        ))}
      </div>
    </div>
  );
}

function TicketCard({
  raffleName,
  fullName,
  dni,
  purchasedAt,
  ticketNumber,
}: {
  raffleName: string;
  fullName: string;
  dni: string;
  purchasedAt: string | null;
  ticketNumber: number;
}) {
  return (
    <div className="ticket-print mx-auto max-w-[34rem] print:max-w-none">
      <article className="relative overflow-hidden rounded-2xl border border-neutral-300 bg-white text-black shadow-md print:rounded-lg print:shadow-none">
        <div
          className="h-1.5 w-full bg-gold"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        />

        <div className="flex">
          {/* Talón: logo, sorteo y número */}
          <div className="flex w-[46%] flex-col items-center justify-center border-r border-dashed border-neutral-300 p-5 text-center">
            <BrandLogo className="h-auto w-20" />
            <h2 className="mt-2 font-display text-base font-medium leading-snug">
              {raffleName}
            </h2>
            <p className="mt-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Número asignado
            </p>
            <p className="mt-0.5 font-display text-5xl font-black leading-none tabular-nums">
              {String(ticketNumber).padStart(4, "0")}
            </p>
          </div>

          {/* Datos */}
          <dl className="flex flex-1 flex-col justify-center gap-2.5 p-5 text-sm">
            <Row label="Nombre" value={fullName} />
            <Row label="DNI" value={dni} />
            {purchasedAt ? (
              <Row label="Fecha de compra" value={purchasedAt} />
            ) : null}
          </dl>
        </div>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-2 last:border-0">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
