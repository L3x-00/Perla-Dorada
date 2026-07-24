"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Countdown } from "@/app/countdown";
import { DocumentField } from "@/components/site/document-field";
import {
  siteButtonClass,
  siteInputClass,
  siteLabelClass,
} from "@/components/site/form-controls";
import type { DocumentType } from "@/lib/validation/document";
import { normalizeTrackingCode } from "@/lib/validation/document";

type PurchaseRequestStatus = "pending" | "approved" | "rejected" | "expired";

type TrackingResult = {
  requestId: string;
  raffleName: string;
  status: PurchaseRequestStatus;
  expiresAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  ticketNumbers: number[];
};

type TrackingResponse = {
  request?: TrackingResult;
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

  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

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

      if (!response.ok || !body.request) {
        throw new Error(body.error ?? "No se pudo consultar la solicitud.");
      }

      setResult(body.request);
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

  const expiresAt = result?.expiresAt ? formatDate(result.expiresAt) : null;
  const reviewedAt = result?.reviewedAt ? formatDate(result.reviewedAt) : null;

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
          <label htmlFor="tracking-code" className={siteLabelClass}>
            Código de seguimiento
          </label>

          <input
            id="tracking-code"
            name="trackingCode"
            value={trackingCode}
            onChange={(event) =>
              setTrackingCode(normalizeTrackingCode(event.target.value))
            }
            required
            minLength={6}
            maxLength={40}
            autoComplete="off"
            placeholder="Ej. K7M2QX4B"
            className={`${siteInputClass} font-mono uppercase tracking-[0.2em]`}
          />
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

      {result ? (
        <section className="mt-6 rounded-2xl border border-line bg-ink-2 p-6">
          <header>
            <p className="text-sm text-muted">Rifa</p>

            <h2 className="mt-1 font-display text-2xl font-light text-cream">
              {result.raffleName}
            </h2>
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
                    La solicitud está aprobada, pero todavía no aparecen
                    tickets asignados.
                  </dd>
                )}

                {result.ticketNumbers.length > 0 ? (
                  <dd className="mt-4">
                    <Link
                      href="/seguimiento/tickets"
                      className="inline-flex rounded-lg border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
                    >
                      Descargar / imprimir mis tickets
                    </Link>
                  </dd>
                ) : null}
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
      ) : null}
    </div>
  );
}
