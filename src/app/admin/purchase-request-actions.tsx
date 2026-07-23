"use client";

import { useRouter } from "next/navigation";

import {
  adminInput,
  btnDanger,
  btnSmall,
  btnSuccess,
} from "@/components/admin/ui";
import { useState } from "react";

type PurchaseRequestActionsProps = {
  purchaseRequestId: string;
  status: "pending" | "approved" | "rejected" | "expired";
};

type ApiResponse = {
  error?: string;
  tickets?: Array<{
    ticket_id: string;
    ticket_number: number;
  }>;
};

export function PurchaseRequestActions({
  purchaseRequestId,
  status,
}: PurchaseRequestActionsProps) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (status !== "pending") {
    return null;
  }

  async function approve() {
    const confirmed = window.confirm(
      "¿Confirmas la aprobación? Los tickets serán asignados de forma definitiva.",
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/approve`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          body.error ?? "No se pudo aprobar la solicitud.",
        );
      }

      const ticketNumbers =
        body.tickets?.map((ticket) => ticket.ticket_number) ?? [];

      setMessage(
        ticketNumbers.length > 0
          ? `Aprobada. Tickets: ${ticketNumbers.join(", ")}`
          : "Solicitud aprobada.",
      );

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reject() {
    const reason = rejectionReason.trim();

    if (reason.length < 5) {
      setMessage(
        "El motivo debe tener al menos 5 caracteres.",
      );
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/reject`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
          }),
        },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          body.error ?? "No se pudo rechazar la solicitud.",
        );
      }

      setMessage("Solicitud rechazada.");
      setShowRejectForm(false);
      setRejectionReason("");

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 min-w-52">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={isSubmitting}
          className={`${btnSuccess} ${btnSmall}`}
        >
          {isSubmitting ? "Procesando..." : "Aprobar"}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowRejectForm((current) => !current);
            setMessage(null);
          }}
          disabled={isSubmitting}
          className={`${btnDanger} ${btnSmall}`}
        >
          Rechazar
        </button>
      </div>

      {showRejectForm ? (
        <div className="mt-3">
          <textarea
            value={rejectionReason}
            onChange={(event) =>
              setRejectionReason(event.target.value)
            }
            maxLength={500}
            rows={3}
            placeholder="Motivo del rechazo"
            className={`${adminInput} text-xs`}
          />

          <button
            type="button"
            onClick={reject}
            disabled={isSubmitting}
            className={`${btnDanger} ${btnSmall} mt-2`}
          >
            Confirmar rechazo
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-2 text-xs text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}