import { NextResponse } from "next/server";

import { RAFFLE_IMAGES_BUCKET } from "@/config/storage";
import { recordAuditEvent } from "@/lib/audit/log";
import {
  createRaffleImagePath,
  validateRaffleImage,
} from "@/lib/storage/images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 6 * 1024 * 1024;

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function requireAdmin(): Promise<string | null> {
  const sessionClient = await createClient();
  const { data, error } = await sessionClient.auth.getClaims();
  const adminUserId = data?.claims?.sub;

  return error || typeof adminUserId !== "string" ? null : adminUserId;
}

/** Sube (o reemplaza) la foto del premio de una rifa. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonError("El identificador de la rifa no es válido.", 400);
  }

  const adminUserId = await requireAdmin();

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

  const { data: raffle } = await supabase
    .from("raffles")
    .select("id, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!raffle) {
    return jsonError("La rifa no existe.", 404);
  }

  let imagePath: string;

  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError("Debes seleccionar una imagen.", 400);
    }

    const validated = await validateRaffleImage(file);
    imagePath = createRaffleImagePath(id, validated.extension);

    const { error: uploadError } = await supabase.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .upload(imagePath, validated.buffer, {
        contentType: validated.mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error subiendo imagen de rifa:", uploadError);
      return jsonError("No se pudo subir la imagen.", 500);
    }
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }

    return jsonError("No se pudo procesar la imagen.", 500);
  }

  const { error: updateError } = await supabase
    .from("raffles")
    .update({ image_path: imagePath })
    .eq("id", id);

  if (updateError) {
    /* Compensación: si no se pudo asociar, no dejamos el objeto huérfano. */
    await supabase.storage.from(RAFFLE_IMAGES_BUCKET).remove([imagePath]);

    console.error("Error asociando imagen a la rifa:", updateError);
    return jsonError("No se pudo guardar la imagen.", 500);
  }

  /* La imagen anterior deja de usarse: se elimina para no acumular basura. */
  if (raffle.image_path && raffle.image_path !== imagePath) {
    await supabase.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .remove([raffle.image_path]);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "update_raffle_image",
    entity: "raffles",
    entityId: id,
  });

  return NextResponse.json(
    { success: true, imagePath },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

/** Quita la foto del premio. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonError("El identificador de la rifa no es válido.", 400);
  }

  const adminUserId = await requireAdmin();

  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  const supabase = createAdminClient();

  const { data: raffle } = await supabase
    .from("raffles")
    .select("id, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!raffle) {
    return jsonError("La rifa no existe.", 404);
  }

  if (raffle.image_path) {
    await supabase.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .remove([raffle.image_path]);
  }

  const { error } = await supabase
    .from("raffles")
    .update({ image_path: null })
    .eq("id", id);

  if (error) {
    console.error("Error quitando imagen de la rifa:", error);
    return jsonError("No se pudo quitar la imagen.", 500);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "remove_raffle_image",
    entity: "raffles",
    entityId: id,
  });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
