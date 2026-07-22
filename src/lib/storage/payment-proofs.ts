import "server-only";

import { fileTypeFromBuffer } from "file-type";

import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
  type PaymentProofMimeType,
} from "@/config/storage";

const FILE_EXTENSION_BY_MIME_TYPE: Record<
  PaymentProofMimeType,
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ValidatedPaymentProof = {
  buffer: Buffer;
  mimeType: PaymentProofMimeType;
  extension: string;
};

export async function validatePaymentProof(
  file: File,
): Promise<ValidatedPaymentProof> {
  if (file.size <= 0) {
    throw new Error("El comprobante está vacío.");
  }

  if (file.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
    throw new Error("El comprobante no puede superar los 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = await fileTypeFromBuffer(buffer);

  if (
    !detectedType ||
    !PAYMENT_PROOF_ALLOWED_MIME_TYPES.includes(
      detectedType.mime as PaymentProofMimeType,
    )
  ) {
    throw new Error(
      "El archivo no es una imagen JPG, PNG o WEBP válida.",
    );
  }

  const mimeType = detectedType.mime as PaymentProofMimeType;

  return {
    buffer,
    mimeType,
    extension: FILE_EXTENSION_BY_MIME_TYPE[mimeType],
  };
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