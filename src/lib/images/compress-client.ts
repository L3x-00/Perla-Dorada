"use client";

/*
 * Compresión obligatoria de imágenes en el navegador.
 *
 * El archivo que llega a Storage nunca es el original: se vuelve a dibujar
 * en Canvas, lo que elimina metadatos EXIF (incluida ubicación) y permite
 * aplicar un límite real de dimensiones y peso. El servidor impone un tope
 * complementario porque el cliente se puede manipular.
 */

export type CompressImageOptions = {
  /** Lado más largo permitido, en píxeles. */
  maxDimension?: number;
  /** Tamaño máximo del archivo resultante, en bytes. */
  maxBytes?: number;
  /** Formato de salida preferido. Si no está disponible, se usa JPEG. */
  preferredMimeType?: "image/webp" | "image/jpeg";
  /** Calidad mínima para no sacrificar legibilidad. */
  minQuality?: number;
};

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 1600,
  maxBytes: 512 * 1024,
  preferredMimeType: "image/webp",
  minQuality: 0.6,
};

/* Comprobantes: prioriza texto legible; el servidor acepta hasta 600 KiB. */
export const PROOF_COMPRESSION: CompressImageOptions = {
  maxDimension: 2000,
  maxBytes: 512 * 1024,
  preferredMimeType: "image/webp",
  minQuality: 0.65,
};

/* Fotos públicas: se sirven a todos los visitantes, por eso son más ligeras. */
export const RAFFLE_IMAGE_COMPRESSION: CompressImageOptions = {
  maxDimension: 1920,
  maxBytes: 300 * 1024,
  preferredMimeType: "image/webp",
  minQuality: 0.55,
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

export class ImageCompressionError extends Error {
  constructor() {
    super(
      "No pudimos optimizar la imagen sin perder legibilidad. Elige otra foto más nítida o recórtala antes de enviarla.",
    );
    this.name = "ImageCompressionError";
  }
}

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

async function loadWithImageElement(file: File): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = "async";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ImageCompressionError());
      element.src = objectUrl;
    });

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new ImageCompressionError();
    }

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    if (bitmap.width <= 0 || bitmap.height <= 0) {
      bitmap.close();
      throw new ImageCompressionError();
    }

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new ImageCompressionError();
  }

  return loadWithImageElement(file);
}

/**
 * Redimensiona y recomprime una imagen antes de subirla.
 *
 * A diferencia de la versión anterior, nunca devuelve el original como
 * fallback: si no puede producir un archivo dentro del límite sin bajar de
 * la calidad mínima, el llamador debe pedir otra foto. Esto evita que una
 * incompatibilidad del navegador anule el ahorro de Storage y egress.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new ImageCompressionError();
  }

  const opts = { ...DEFAULTS, ...options };
  let loaded: LoadedImage | null = null;

  try {
    loaded = await loadImage(file);

    let { width, height } = loaded;
    const longestSide = Math.max(width, height);

    if (longestSide > opts.maxDimension) {
      const scale = opts.maxDimension / longestSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new ImageCompressionError();
    }

    context.drawImage(loaded.source, 0, 0, width, height);

    let mimeType: string = opts.preferredMimeType;
    let quality = 0.88;
    let blob = await canvasToBlob(canvas, mimeType, quality);

    if (!blob || blob.type !== mimeType) {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, mimeType, quality);
    }

    let attempts = 0;
    while (
      blob &&
      blob.size > opts.maxBytes &&
      quality > opts.minQuality &&
      attempts < 7
    ) {
      quality = Math.max(opts.minQuality, quality - 0.06);
      blob = await canvasToBlob(canvas, mimeType, quality);
      attempts += 1;
    }

    if (!blob || blob.size > opts.maxBytes) {
      throw new ImageCompressionError();
    }

    const extension = mimeType === "image/webp" ? "webp" : "jpg";

    return new File([blob], `${withoutExtension(file.name)}.${extension}`, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof ImageCompressionError) {
      throw error;
    }

    throw new ImageCompressionError();
  } finally {
    loaded?.release();
  }
}
