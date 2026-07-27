import "server-only";

import {
  PAYMENT_PROOF_MAX_SIZE_BYTES,
  PAYMENT_PROOF_STORAGE_MAX_SIZE_BYTES,
} from "@/config/storage";
import {
  validateImageFile,
  type ValidatedImage,
} from "@/lib/storage/images";

export type ValidatedPaymentProof = ValidatedImage;

/*
 * La ruta pública compara estos mensajes controlados para decidir qué puede
 * mostrar al cliente. Se conservan como contrato de validación.
 */
export async function validatePaymentProof(
  file: File,
): Promise<ValidatedPaymentProof> {
  return validateImageFile(
    file,
    {
      empty: "El comprobante está vacío.",
      inputTooLarge: "El comprobante no puede superar los 5 MB.",
      tooLarge:
        "No pudimos optimizar el comprobante lo suficiente. Elige una foto más nítida o recórtala antes de enviarla.",
      invalidType: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    },
    {
      maxInputBytes: PAYMENT_PROOF_MAX_SIZE_BYTES,
      maxStoredBytes: PAYMENT_PROOF_STORAGE_MAX_SIZE_BYTES,
      maxDimension: 2000,
    },
  );
}

export function createPaymentProofPath(
  raffleId: string,
  requestId: string,
  extension: string,
): string {
  return [
    "raffles",
    raffleId,
    "requests",
    requestId,
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");
}
