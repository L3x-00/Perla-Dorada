"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Countdown } from "@/app/countdown";
import { DocumentField } from "@/components/site/document-field";
import { siteButtonClass } from "@/components/site/form-controls";
import {
  normalizeTrackingCode,
  type DocumentType,
} from "@/lib/validation/document";

type PurchaseRequestStatus = "pending" | "approved" | "rejected" | "expired";

type TrackingResult = {
  requestId: string;
  raffleName: string;
  status: PurchaseRequestStatus;
  requestedAt: string;
  expiresAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  ticketNumbers: number[];
};

type TrackingResponse = {
  requests?: TrackingResult[];
  error?: string;
};

const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  pending: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(date);
}

export function TrackingForm() {
  const [documentType, setDocumentType] = useState<DocumentType>("dni");
  const [documentNumber, setDocumentNumber] = useState("");
  const [trackingCode, setTrackingCode] = useState("");

  const [results, setResults] = useState<TrackingResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          dni: documentNumber,
          trackingCode,
        }),
      });

      const body = (await response.json()) as TrackingResponse;

      if (!response.ok || !body.requests) {
        throw new Error(body.error ?? "No se pudo consultar la solicitud.");
      }

      setResults(body.requests);
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

  const hasApprovedTickets =
    results?.some((result) => result.status === "approved") ?? false;

  return (
    <div className="mx-auto max-w-lg">
      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-line bg-ink-2 p-6"
      >
        <DocumentField
          idPrefix="tracking"
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          value={documentNumber}
          onValueChange={setDocumentNumber}
          showHint={false}
        />

        <div>
          <label htmlFor="tracking-code" className="sr-only">
            Código de seguimiento
          </label>
          <input
            id="tracking-code"
            value={trackingCode}
            onChange={(event) =>
              setTrackingCode(normalizeTrackingCode(event.target.value).slice(0, 16))
            }
            required
            minLength={8}
            maxLength={16}
            autoComplete="off"
            placeholder="Código de seguimiento"
            className="h-11 w-full rounded-lg border border-line bg-ink px-3 font-mono text-sm uppercase text-cream outline-none transition placeholder:font-sans placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <p className="mt-2 text-xs text-muted">
            Lo recibiste al registrar tu solicitud.
          </p>
        </div>

        <button type="submit" disabled={submitting} className={siteButtonClass}>
          {submitting ? "Consultando..." : "Consultar estado"}
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

      {results && results.length > 0 ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted">
            {results.length === 1
              ? "1 solicitud encontrada."
              : `${results.length} solicitudes encontradas, más reciente primero.`}
          </p>

          {results.map((result) => (
            <TrackingResultCard key={result.requestId} result={result} />
          ))}

          {hasApprovedTickets ? (
            <Link
              href="/seguimiento/tickets"
              onClick={() => {
                /*
                 * Pasa el DNI ya escrito a la página de tickets para no
                 * volver a pedirlo. Va por sessionStorage (no en la URL)
                 * para no dejarlo en el historial ni en el referer.
                 */
                try {
                  sessionStorage.setItem(
                    "pd:ticket-lookup",
                    JSON.stringify({
                      documentType,
                      documentNumber,
                      trackingCode,
                    }),
                  );
                } catch {
                  /* Modo privado sin storage: pedirá el dato una vez. */
                }
              }}
              className="inline-flex rounded-lg border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
            >
              Descargar / imprimir mis tickets
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TrackingResultCard({ result }: { result: TrackingResult }) {
  const expiresAt = formatDate(result.expiresAt);
  const reviewedAt = formatDate(result.reviewedAt);
  const requestedAt = formatDate(result.requestedAt);

  return (
    <section className="rounded-2xl border border-line bg-ink-2 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Rifa</p>
          <h2 className="mt-1 font-display text-2xl font-light text-cream">
            {result.raffleName}
          </h2>
        </div>
        {requestedAt ? (
          <p className="text-xs text-muted">Solicitada el {requestedAt}</p>
        ) : null}
      </header>

      <dl className="mt-6 space-y-5">
        <div>
          <dt className="text-sm text-muted">Estado</dt>

          <dd className="mt-1 text-lg font-medium text-cream">
            {STATUS_LABELS[result.status]}
          </dd>
        </div>

        {result.status === "pending" && expiresAt ? (
          <div>
            <dt className="text-sm text-muted">Reserva válida hasta</dt>

            <dd className="mt-1">{expiresAt}</dd>

            <dd className="mt-1 text-sm">
              <Countdown expiresAt={result.expiresAt} />
            </dd>
          </div>
        ) : null}

        {result.status === "approved" ? (
          <div>
            <dt className="text-sm text-muted">Tickets asignados</dt>

            {result.ticketNumbers.length > 0 ? (
              <dd className="mt-3 flex flex-wrap gap-3">
                {result.ticketNumbers.map((ticketNumber) => (
                  <span
                    key={ticketNumber}
                    className="rounded-xl border border-emerald-700 bg-emerald-950 px-4 py-3 text-xl font-bold tabular-nums text-emerald-200"
                  >
                    {String(ticketNumber).padStart(4, "0")}
                  </span>
                ))}
              </dd>
            ) : (
              <dd className="mt-2 text-sm text-muted">
                La solicitud está aprobada, pero todavía no aparecen tickets
                asignados.
              </dd>
            )}
          </div>
        ) : null}

        {result.status === "rejected" && result.rejectionReason ? (
          <div>
            <dt className="text-sm text-muted">Motivo</dt>

            <dd className="mt-1">{result.rejectionReason}</dd>
          </div>
        ) : null}

        {reviewedAt ? (
          <div>
            <dt className="text-sm text-muted">Fecha de revisión</dt>

            <dd className="mt-1">{reviewedAt}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
