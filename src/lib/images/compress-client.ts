"use client";

/*
 * Compresión de imágenes EN EL NAVEGADOR, antes de subir.
 *
 * Motivo (ver docs/contex/alcancefree.md §4 y §8): en el plan gratuito de
 * Supabase, el Storage (1 GB) y el egress (5 GB/mes) son los límites que este
 * sistema toca primero. Cada comprobante puede pesar hasta 5 MB de foto de
 * celular sin comprimir, y la foto del premio se sirve a todos los
 * visitantes de la landing. Recomprimir en el cliente antes de subir
 * multiplica por ~5-10 la capacidad efectiva sin pagar ningún servicio de
 * jobs ni tocar el servidor: usa el Canvas del propio navegador del usuario.
 *
 * Es "mejor esfuerzo": si algo falla (navegador viejo, imagen corrupta,
 * SVG, etc.) se devuelve el archivo original sin tocar. La validación real
 * de tamaño/tipo sigue en el servidor (src/lib/storage/images.ts), que
 * inspecciona los bytes reales — esto es solo una optimización, nunca la
 * fuente de verdad de qué se acepta.
 */

export type CompressImageOptions = {
  /** Lado más largo permitido, en píxeles. */
  maxDimension?: number;
  /** Tamaño objetivo a no superar, en bytes. */
  maxBytes?: number;
  /** Formato de salida preferido. Si el navegador no sabe codificarlo, cae a JPEG. */
  preferredMimeType?: "image/webp" | "image/jpeg";
  /** Piso de calidad: por debajo de esto se deja de bajar más (evita bloques visibles). */
  minQuality?: number;
};

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 1600,
  maxBytes: 320 * 1024,
  preferredMimeType: "image/webp",
  minQuality: 0.45,
};

/** Presets alineados a docs/contex/alcancefree.md §8 (comprimir ≤ ~300 KB). */
export const PROOF_COMPRESSION: CompressImageOptions = {
  maxDimension: 1600,
  maxBytes: 320 * 1024,
  preferredMimeType: "image/webp",
};

export const RAFFLE_IMAGE_COMPRESSION: CompressImageOptions = {
  maxDimension: 1920,
  maxBytes: 300 * 1024,
  preferredMimeType: "image/webp",
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}

/**
 * Redimensiona y recomprime una imagen en el navegador. Nunca devuelve algo
 * más pesado que el original: si la compresión no ayuda o falla, se
 * devuelve el archivo tal cual llegó.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;
    const longestSide = Math.max(width, height);

    if (longestSide > opts.maxDimension) {
      const scale = opts.maxDimension / longestSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);

    let mimeType: string = opts.preferredMimeType;
    let quality = 0.82;
    let blob = await canvasToBlob(canvas, mimeType, quality);

    /*
     * Algunos navegadores no saben codificar WEBP y devuelven null (o un
     * blob de otro tipo). Se cae a JPEG, universalmente soportado.
     */
    if (!blob || blob.type !== mimeType) {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, mimeType, quality);
    }

    if (!blob) {
      return file;
    }

    let attempts = 0;

    while (
      blob &&
      blob.size > opts.maxBytes &&
      quality > opts.minQuality &&
      attempts < 6
    ) {
      quality = Math.max(opts.minQuality, quality - 0.12);
      blob = await canvasToBlob(canvas, mimeType, quality);
      attempts += 1;
    }

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const extension = mimeType === "image/webp" ? "webp" : "jpg";

    return new File([blob], `${withoutExtension(file.name)}.${extension}`, {
      type: mimeType,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
