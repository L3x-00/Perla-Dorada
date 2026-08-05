"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminInput } from "@/components/admin/ui";

type VoidParticipationActionProps = {
  purchaseRequestId: string;
  ticketCount: number;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

/*
 * Anula la participación completa de una solicitud (devolución de compra
 * antes del sorteo). Siempre pide motivo: es una acción menos frecuente y
 * más delicada que reimprimir, así que no hay atajo de un solo clic.
 */
export function VoidParticipationAction({
  purchaseRequestId,
  ticketCount,
}: VoidParticipationActionProps) {
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function voidParticipation() {
    const normalizedReason = reason.trim();

    if (normalizedReason.length < 5) {
      setError("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/void`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: normalizedReason }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "No se pudo anular la participación.");
      }

      setShowForm(false);
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

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex items-center justify-center rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-xs font-medium text-danger transition-opacity duration-200 hover:opacity-80"
      >
        Anular participación
      </button>
    );
  }

  return (
    <div className="min-w-56 space-y-2">
      <label
        htmlFor={`void-reason-${purchaseRequestId}`}
        className="block text-xs font-medium text-muted"
      >
        Motivo de anulación ({ticketCount}{" "}
        {ticketCount === 1 ? "ticket" : "tickets"})
      </label>

      <textarea
        id={`void-reason-${purchaseRequestId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        minLength={5}
        maxLength={500}
        disabled={submitting}
        placeholder="Ejemplo: el cliente devolvió su compra antes del sorteo"
        className={`${adminInput} text-xs`}
      />

      <p className="text-right text-xs text-muted">{reason.length}/500</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={voidParticipation}
          disabled={submitting || reason.trim().length < 5}
          className="inline-flex items-center justify-center rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-xs font-semibold text-danger transition-opacity duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Anulando..." : "Confirmar anulación"}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setReason("");
            setError(null);
          }}
          disabled={submitting}
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>

      {error ? (
        <p role="alert" className="max-w-xs text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
