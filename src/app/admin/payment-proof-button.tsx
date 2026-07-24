"use client";

import { useCallback, useEffect, useState } from "react";

import { CloseIcon } from "@/components/site/icons";
import { btnGhost, btnSmall } from "@/components/admin/ui";

/*
 * Datos del cliente que se muestran junto al comprobante dentro del modal.
 * Son los que el admin necesita para contrastar la captura del Yape sin
 * cambiar de fila ni de pestaña.
 */
export type PaymentProofClient = {
  fullName: string;
  documentTypeLabel: string;
  documentNumber: string;
  phone: string;
  whatsapp: string;
  trackingCode: string;
  requestedQuantity: number;
};

type PaymentProofButtonProps = {
  purchaseRequestId: string;
  client: PaymentProofClient;
  disabled?: boolean;
};

type PaymentProofResponse = {
  signedUrl?: string;
  error?: string;
};

/*
 * Antes esto abría el comprobante en una pestaña nueva: el admin perdía el
 * contexto de la solicitud y tenía que ir y volver. Ahora abre un modal con
 * la imagen y, al lado, los datos del cliente, para revisar y decidir sin
 * moverse de la tabla.
 */
export function PaymentProofButton({
  purchaseRequestId,
  client,
  disabled = false,
}: PaymentProofButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setSignedUrl(null);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  async function open() {
    setIsOpen(true);
    setIsLoading(true);
    setErrorMessage(null);
    setSignedUrl(null);

    try {
      const response = await fetch(
        `/api/admin/purchase-requests/${purchaseRequestId}/payment-proof`,
        { method: "GET", credentials: "same-origin", cache: "no-store" },
      );

      const body = (await response.json()) as PaymentProofResponse;

      if (!response.ok || !body.signedUrl) {
        throw new Error(body.error ?? "No se pudo abrir el comprobante.");
      }

      setSignedUrl(body.signedUrl);
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
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={`${btnGhost} ${btnSmall}`}
      >
        Ver comprobante
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Comprobante de ${client.fullName}`}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <p className="eyebrow text-gold">Comprobante de pago</p>
                <h2 className="mt-1 font-display text-xl font-light text-cream">
                  {client.fullName}
                </h2>
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="rounded-full border border-line p-2 text-muted transition-colors hover:border-gold hover:text-gold"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_260px]">
              <div className="flex min-h-0 items-center justify-center overflow-auto bg-ink p-4">
                {isLoading ? (
                  <p className="text-sm text-muted">Cargando comprobante…</p>
                ) : errorMessage ? (
                  <p className="max-w-sm text-center text-sm text-red-300">
                    {errorMessage}
                  </p>
                ) : signedUrl ? (
                  /*
                   * URL firmada de vida corta del bucket privado. Su origen
                   * (Supabase) está permitido en img-src de la CSP.
                   * <img> nativo: no hay que optimizar un recurso efímero.
                   */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrl}
                    alt={`Comprobante de pago de ${client.fullName}`}
                    className="max-h-[70vh] w-auto rounded-lg object-contain"
                  />
                ) : null}
              </div>

              <dl className="space-y-4 overflow-auto border-t border-line p-5 text-sm md:border-l md:border-t-0">
                <Detail label={client.documentTypeLabel}>
                  {client.documentNumber}
                </Detail>
                <Detail label="Teléfono">{client.phone}</Detail>
                <Detail label="WhatsApp">{client.whatsapp}</Detail>
                <Detail label="Cantidad de boletos">
                  {client.requestedQuantity}
                </Detail>
                <Detail label="Código de seguimiento">
                  <span className="font-mono text-gold-soft">
                    {client.trackingCode}
                  </span>
                </Detail>

                {signedUrl ? (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-sm text-gold underline-offset-4 hover:underline"
                  >
                    Abrir en pestaña nueva
                  </a>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-cream">{children}</dd>
    </div>
  );
}
