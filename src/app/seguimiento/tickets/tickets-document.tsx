"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { formatCurrencyPEN, formatDateTime } from "@/lib/format";

type TicketDocument = {
  raffleName: string;
  raffleDescription: string | null;
  drawAt: string | null;
  ticketPrice: number;
  fullName: string;
  dni: string;
  trackingCode: string;
  ticketNumbers: number[];
};

type ApiResponse = {
  document?: TicketDocument;
  error?: string;
};

export function TicketsDocument() {
  const [dni, setDni] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<TicketDocument | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setDocument(null);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni, trackingCode }),
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.document) {
        throw new Error(
          body.error ?? "No se pudo obtener los tickets.",
        );
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
  }

  return (
    <div className="px-6 pt-32 pb-24 print:bg-white print:p-0 print:pt-0">
      {!document ? (
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

          <h1 className="font-display text-3xl font-light text-cream">Descargar mis tickets</h1>
          <p className="mt-2 text-sm text-muted">
            Disponible solo para solicitudes aprobadas. Ingresa tu DNI y tu
            código de seguimiento.
          </p>

          <form
            onSubmit={submit}
            className="mt-6 space-y-5 rounded-2xl border border-line bg-ink-2 p-6"
          >
            <div>
              <label
                htmlFor="tickets-dni"
                className="eyebrow mb-2.5 block text-muted"
              >
                DNI
              </label>
              <input
                id="tickets-dni"
                value={dni}
                onChange={(event) => setDni(event.target.value)}
                required
                minLength={6}
                maxLength={20}
                autoComplete="off"
                inputMode="numeric"
                className="w-full rounded-lg border border-line bg-ink px-4 py-3.5 text-cream outline-none transition-colors focus:border-gold"
              />
            </div>

            <div>
              <label
                htmlFor="tickets-code"
                className="eyebrow mb-2.5 block text-muted"
              >
                Código de seguimiento
              </label>
              <input
                id="tickets-code"
                value={trackingCode}
                onChange={(event) =>
                  setTrackingCode(event.target.value.toUpperCase())
                }
                required
                minLength={6}
                maxLength={40}
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-ink px-4 py-3.5 font-mono uppercase text-cream outline-none transition-colors focus:border-gold"
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
      ) : (
        <TicketSheet document={document} onReset={() => setDocument(null)} />
      )}
    </div>
  );
}

function TicketSheet({
  document,
  onReset,
}: {
  document: TicketDocument;
  onReset: () => void;
}) {
  const drawAt = formatDateTime(document.drawAt);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
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

      <article className="rounded-2xl border-2 border-black bg-white p-8 text-black shadow-lg print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b-2 border-black pb-5 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em]">
            Joyería Perla Dorada
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase">
            {document.raffleName}
          </h1>
          {document.raffleDescription ? (
            <p className="mt-3 text-sm">{document.raffleDescription}</p>
          ) : null}
        </header>

        <section className="grid gap-2 border-b-2 border-black py-5 text-sm">
          <p>
            <strong>Participante:</strong> {document.fullName}
          </p>
          <p>
            <strong>DNI:</strong> {document.dni}
          </p>
          <p>
            <strong>Código de seguimiento:</strong> {document.trackingCode}
          </p>
          <p>
            <strong>Precio por boleto:</strong>{" "}
            {formatCurrencyPEN(document.ticketPrice)}
          </p>
          {drawAt ? (
            <p>
              <strong>Fecha del sorteo:</strong> {drawAt}
            </p>
          ) : null}
          <p>
            <strong>Total de tickets:</strong> {document.ticketNumbers.length}
          </p>
        </section>

        <section className="py-6">
          <p className="mb-4 text-center text-sm font-bold uppercase tracking-wide">
            Números asignados
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {document.ticketNumbers.map((ticketNumber) => (
              <div
                key={ticketNumber}
                className="rounded-lg border-2 border-black py-4 text-center text-2xl font-black tabular-nums"
              >
                {String(ticketNumber).padStart(4, "0")}
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t-2 border-black pt-4 text-center text-[11px] text-neutral-700">
          Conserva este documento. Los números son únicos y válidos para el
          sorteo indicado.
        </footer>
      </article>
    </div>
  );
}
