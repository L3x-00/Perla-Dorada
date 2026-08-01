import { NextResponse } from "next/server";

import { RAFFLE_IMAGES_BUCKET } from "@/config/storage";
import { requireActiveAdmin } from "@/lib/auth/admin";
import {
  createPromotionImagePath,
  validatePromotionImage,
} from "@/lib/storage/images";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 6 * 1024 * 1024;

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/*
 * Sube una foto de promoción a "staging" y devuelve su ruta. Se usa desde el
 * formulario de crear/editar promoción: la foto se sube primero (esta ruta)
 * y su ruta viaja luego dentro del cuerpo al crear/actualizar la promoción.
 *
 * El bucket es PÚBLICO (raffle-images, carpeta promotions/), el mismo que
 * usan las fotos de premio.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  const contentType = request.headers.get("content-type");

  if (!contentType?.includes("multipart/form-data")) {
    return jsonError(
      "El contenido debe enviarse como multipart/form-data.",
      415,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError("El contenido enviado supera el límite permitido.", 413);
  }

  const supabase = createAdminClient();

  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError("Debes seleccionar una imagen.", 400);
    }

    const validated = await validatePromotionImage(file);
    const path = createPromotionImagePath(validated.extension);

    const { error: uploadError } = await supabase.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .upload(path, validated.buffer, {
        contentType: validated.mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error subiendo foto de promoción:", uploadError);
      return jsonError("No se pudo subir la imagen.", 500);
    }

    return NextResponse.json(
      { success: true, path },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }

    return jsonError("No se pudo procesar la imagen.", 500);
  }
}
