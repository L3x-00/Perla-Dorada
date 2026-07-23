import "server-only";

import {
  validateImageFile,
  type ValidatedImage,
} from "@/lib/storage/images";

export type ValidatedPaymentProof = ValidatedImage;

/*
 * Los mensajes son exactamente los históricos: la ruta pública
 * /api/purchase-requests los compara de forma literal para decidir cuáles
 * puede mostrar al usuario. No cambiarlos sin actualizar esa ruta.
 */
export async function validatePaymentProof(
  file: File,
): Promise<ValidatedPaymentProof> {
  return validateImageFile(file, {
    empty: "El comprobante está vacío.",
    tooLarge: "El comprobante no puede superar los 5 MB.",
    invalidType: "El archivo no es una imagen JPG, PNG o WEBP válida.",
  });
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
