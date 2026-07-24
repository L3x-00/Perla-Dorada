"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnDanger, btnSmall } from "@/components/admin/ui";

type DeleteProofButtonProps = {
  purchaseRequestId: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

/*
 * Elimina la foto del comprobante del bucket y marca la solicitud. Pensado
 * para la fase de pruebas, donde hay capturas equivocadas que hay que sacar
 * de Storage, no solo ocultar. Irreversible, con confirmación.
 */
export function DeleteProofButton({
  purchaseRequestId,
}: DeleteProofButtonProps) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    const confirmed = window.confirm(
      "¿Eliminar el comprobante de esta solicitud? La imagen se borra del almacenamiento y no se puede recuperar.",
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/payment-proof`,
        { method: "DELETE", credentials: "same-origin" },
      );

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "No se pudo eliminar el comprobante.");
      }

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
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={isSubmitting}
        className={`${btnDanger} ${btnSmall}`}
      >
        {isSubmitting ? "Eliminando…" : "Eliminar comprobante"}
      </button>

      {message ? (
        <p className="mt-1 max-w-48 text-xs text-red-300">{message}</p>
      ) : null}
    </div>
  );
}
