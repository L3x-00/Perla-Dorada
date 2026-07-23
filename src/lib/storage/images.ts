import "server-only";

import { fileTypeFromBuffer } from "file-type";

import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
  type PaymentProofMimeType,
} from "@/config/storage";

const FILE_EXTENSION_BY_MIME_TYPE: Record<PaymentProofMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ValidatedImage = {
  buffer: Buffer;
  mimeType: PaymentProofMimeType;
  extension: string;
};

export type ImageValidationMessages = {
  empty: string;
  tooLarge: string;
  invalidType: string;
};

/*
 * Validación de imágenes subidas.
 *
 * No se confía en la extensión ni en el Content-Type declarado: se
 * inspeccionan los bytes reales del archivo, que es lo único que un
 * atacante no puede falsear con solo renombrar.
 *
 * Los mensajes se reciben por parámetro porque cada flujo muestra los
 * suyos y hay rutas que los comparan literalmente.
 */
export async function validateImageFile(
  file: File,
  messages: ImageValidationMessages,
  maxSizeBytes: number = PAYMENT_PROOF_MAX_SIZE_BYTES,
): Promise<ValidatedImage> {
  if (file.size <= 0) {
    throw new Error(messages.empty);
  }

  if (file.size > maxSizeBytes) {
    throw new Error(messages.tooLarge);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = await fileTypeFromBuffer(buffer);

  if (
    !detectedType ||
    !PAYMENT_PROOF_ALLOWED_MIME_TYPES.includes(
      detectedType.mime as PaymentProofMimeType,
    )
  ) {
    throw new Error(messages.invalidType);
  }

  const mimeType = detectedType.mime as PaymentProofMimeType;

  return {
    buffer,
    mimeType,
    extension: FILE_EXTENSION_BY_MIME_TYPE[mimeType],
  };
}

export async function validateRaffleImage(file: File): Promise<ValidatedImage> {
  return validateImageFile(file, {
    empty: "La imagen está vacía.",
    tooLarge: "La imagen no puede superar los 5 MB.",
    invalidType: "El archivo no es una imagen JPG, PNG o WEBP válida.",
  });
}

export function createRaffleImagePath(
  raffleId: string,
  extension: string,
): string {
  return `raffles/${raffleId}/${crypto.randomUUID()}.${extension}`;
}
