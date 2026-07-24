"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { BrandLogo } from "@/components/site/brand-logo";
import { DocumentField } from "@/components/site/document-field";
import { siteLabelClass } from "@/components/site/form-controls";
import { formatDateTime } from "@/lib/format";
import type { DocumentType } from "@/lib/validation/document";
import { normalizeTrackingCode } from "@/lib/validation/document";

type TicketDocument = {
  raffleName: string;
  fullName: string;
  dni: string;
  purchasedAt: string | null;
  ticketNumbers: number[];
};

type ApiResponse = {
  document?: TicketDocument;
  error?: string;
};

/*
 * Clave de traspaso desde la consulta de estado (/seguimiento). Si el usuario
 * ya buscó su solicitud allí, llega con el DNI + código guardados y no se los
 * volvemos a pedir: se cargan los tickets directo.
 */
const LOOKUP_KEY = "pd:ticket-lookup";

export function TicketsDocument() {
  const [documentType, setDocumentType] = useState<DocumentType>("dni");
  const [documentNumber, setDocumentNumber] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<TicketDocument | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  const fetchDocument = useCallback(
    async (dt: DocumentType, dni: string, code: string) => {
      setSubmitting(true);
      setError(null);
      setDocument(null);

      try {
        const response = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentType: dt, dni, trackingCode: code }),
        });

        const body = (await response.json()) as ApiResponse;

        if (!response.ok || !body.document) {
          throw new Error(body.error ?? "No se pudo obtener los tickets.");
        }

        setDocument(body.document);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Ocurrió un error inesperado.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

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

    let parsed: {
      documentType?: unknown;
      documentNumber?: unknown;
      trackingCode?: unknown;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const dni =
      typeof parsed.documentNumber === "string" ? parsed.documentNumber : "";
    const code =
      typeof parsed.trackingCode === "string" ? parsed.trackingCode : "";
    const dt: DocumentType = parsed.documentType === "cui" ? "cui" : "dni";

    if (!dni || !code) {
      return;
    }

    /*
     * El init va dentro de una función asíncrona a propósito: evita disparar
     * setState de forma síncrona dentro del efecto (cascada de renders) y deja
     * la carga como una tarea diferida.
     */
    async function autoLoad() {
      setDocumentType(dt);
      setDocumentNumber(dni);
      setTrackingCode(code);
      setAutoLoading(true);
      try {
        await fetchDocument(dt, dni, code);
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
    await fetchDocument(documentType, documentNumber, trackingCode);
  }

  return (
    <div className="px-6 pt-32 pb-24 print:bg-white print:p-0 print:pt-0">
      {document ? (
        <TicketStack document={document} onReset={() => setDocument(null)} />
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
            Disponible solo para solicitudes aprobadas. Ingresa tu DNI y tu
            código de seguimiento.
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

            <div>
              <label htmlFor="tickets-code" className={siteLabelClass}>
                Código de seguimiento
              </label>
              <input
                id="tickets-code"
                value={trackingCode}
                onChange={(event) =>
                  setTrackingCode(normalizeTrackingCode(event.target.value))
                }
                required
                minLength={6}
                maxLength={40}
                autoComplete="off"
                placeholder="Ej. K7M2QX4B"
                className="w-full rounded-lg border border-line bg-ink px-4 py-3.5 font-mono uppercase tracking-[0.2em] text-cream outline-none transition-colors focus:border-gold"
              />
            </div>

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
  document,
  onReset,
}: {
  document: TicketDocument;
  onReset: () => void;
}) {
  const purchasedAt = formatDateTime(document.purchasedAt);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-light text-cream">
              {document.ticketNumbers.length === 1
                ? "Tu ticket"
                : `Tus ${document.ticketNumbers.length} tickets`}
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
        {document.ticketNumbers.map((ticketNumber) => (
          <TicketCard
            key={ticketNumber}
            raffleName={document.raffleName}
            fullName={document.fullName}
            dni={document.dni}
            purchasedAt={purchasedAt}
            ticketNumber={ticketNumber}
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
    <div className="ticket-print mx-auto max-w-[20rem] print:max-w-none">
      <article className="relative overflow-hidden rounded-2xl border border-neutral-300 bg-white text-black shadow-md print:rounded-lg print:shadow-none">
        <div
          className="h-1.5 w-full bg-gold"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        />

        <div className="px-6 pt-5 text-center">
          <BrandLogo className="mx-auto h-auto w-24" />
          <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Ticket de sorteo
          </p>
          <h2 className="mt-1 font-display text-lg font-medium leading-snug">
            {raffleName}
          </h2>
        </div>

        <div className="my-4 flex items-center gap-2 px-6">
          <span className="text-gold" style={{ printColorAdjust: "exact" }}>
            ◆
          </span>
          <div className="flex-1 border-t border-dashed border-neutral-300" />
          <span className="text-gold" style={{ printColorAdjust: "exact" }}>
            ◆
          </span>
        </div>

        <div className="px-6 text-center">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Número asignado
          </p>
          <p className="mt-1 font-display text-6xl font-black leading-none tabular-nums">
            {String(ticketNumber).padStart(4, "0")}
          </p>
        </div>

        <dl className="mt-6 space-y-2.5 px-6 pb-6 text-sm">
          <Row label="Nombre" value={fullName} />
          <Row label="DNI" value={dni} />
          {purchasedAt ? <Row label="Fecha de compra" value={purchasedAt} /> : null}
        </dl>
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
