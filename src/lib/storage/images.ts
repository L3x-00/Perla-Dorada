import "server-only";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
  RAFFLE_IMAGE_STORAGE_MAX_SIZE_BYTES,
  type PaymentProofMimeType,
} from "@/config/storage";

const MAX_INPUT_PIXELS = 40_000_000;

export type ValidatedImage = {
  buffer: Buffer;
  mimeType: PaymentProofMimeType;
  extension: string;
};

export type ImageValidationMessages = {
  empty: string;
  inputTooLarge: string;
  tooLarge: string;
  invalidType: string;
};

type ImageStorageOptions = {
  maxInputBytes: number;
  maxStoredBytes: number;
  maxDimension: number;
};

/*
 * Reencoda siempre antes de Storage. Esto cubre tanto el flujo normal
 * (Canvas en el navegador) como navegadores sin Canvas o envíos directos al
 * endpoint: nunca se conserva el original ni sus metadatos. Sharp elimina
 * metadatos por defecto, respeta la orientación EXIF y limita los píxeles de
 * entrada para evitar una imagen-bomba comprimida.
 */
async function optimizeForStorage(
  input: Buffer,
  maxStoredBytes: number,
  maxDimension: number,
  messages: ImageValidationMessages,
): Promise<ValidatedImage> {
  const profiles = [
    { dimension: maxDimension, quality: 84 },
    { dimension: maxDimension, quality: 80 },
    { dimension: maxDimension, quality: 76 },
    { dimension: maxDimension, quality: 72 },
    { dimension: Math.round(maxDimension * 0.85), quality: 76 },
    { dimension: Math.round(maxDimension * 0.7), quality: 72 },
  ];

  try {
    for (const profile of profiles) {
      const buffer = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: profile.dimension,
          height: profile.dimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: profile.quality,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer();

      if (buffer.byteLength <= maxStoredBytes) {
        return {
          buffer,
          mimeType: "image/webp",
          extension: "webp",
        };
      }
    }
  } catch {
    throw new Error(messages.invalidType);
  }

  throw new Error(messages.tooLarge);
}

/*
 * No se confía en extensión ni Content-Type: se inspeccionan bytes reales
 * antes de decodificar. El tope de entrada evita presión de memoria y el de
 * salida es el que realmente se aplica al objeto persistido en Storage.
 */
export async function validateImageFile(
  file: File,
  messages: ImageValidationMessages,
  options: ImageStorageOptions,
): Promise<ValidatedImage> {
  if (file.size <= 0) {
    throw new Error(messages.empty);
  }

  if (file.size > options.maxInputBytes) {
    throw new Error(messages.inputTooLarge);
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

  return optimizeForStorage(
    buffer,
    options.maxStoredBytes,
    options.maxDimension,
    messages,
  );
}

export async function validateRaffleImage(file: File): Promise<ValidatedImage> {
  return validateImageFile(
    file,
    {
      empty: "La imagen está vacía.",
      inputTooLarge: "La imagen no puede superar los 5 MB.",
      tooLarge:
        "No pudimos optimizar la imagen lo suficiente. Elige otra foto o recórtala antes de subirla.",
      invalidType: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    },
    {
      maxInputBytes: PAYMENT_PROOF_MAX_SIZE_BYTES,
      maxStoredBytes: RAFFLE_IMAGE_STORAGE_MAX_SIZE_BYTES,
      maxDimension: 1920,
    },
  );
}

export function createRaffleImagePath(
  raffleId: string,
  extension: string,
): string {
  return `raffles/${raffleId}/${crypto.randomUUID()}.${extension}`;
}

/*
 * Ruta para una foto subida ANTES de que exista la rifa (premio mayor o
 * premios de la lista, desde el formulario de creación). Vive en la carpeta
 * "prizes/" del mismo bucket público; la rifa la referencia al guardarse.
 */
export function createStagedPrizeImagePath(extension: string): string {
  return `prizes/${crypto.randomUUID()}.${extension}`;
}
