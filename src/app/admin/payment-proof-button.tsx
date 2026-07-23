"use client";

import { useState } from "react";

import { btnGhost, btnSmall } from "@/components/admin/ui";

type PaymentProofButtonProps = {
  purchaseRequestId: string;
  disabled?: boolean;
};

type PaymentProofResponse = {
  signedUrl?: string;
  error?: string;
};

export function PaymentProofButton({
  purchaseRequestId,
  disabled = false,
}: PaymentProofButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  async function handleOpenPaymentProof() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/payment-proof`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const body =
        (await response.json()) as PaymentProofResponse;

      if (!response.ok || !body.signedUrl) {
        throw new Error(
          body.error ?? "No se pudo abrir el comprobante.",
        );
      }

      const openedWindow = window.open(
        body.signedUrl,
        "_blank",
        "noopener,noreferrer",
      );

      if (!openedWindow) {
        throw new Error(
          "El navegador bloqueó la nueva ventana.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleOpenPaymentProof}
        disabled={disabled || isLoading}
        className={`${btnGhost} ${btnSmall}`}
      >
        {isLoading ? "Abriendo..." : "Ver comprobante"}
      </button>

      {errorMessage ? (
        <p className="mt-2 max-w-48 text-xs text-red-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}