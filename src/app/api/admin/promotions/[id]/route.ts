import { NextResponse } from "next/server";
import { z } from "zod";

import { RAFFLE_IMAGES_BUCKET } from "@/config/storage";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { promotionInputSchema } from "@/lib/promotions/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(
  error: string,
  status: number,
  fields?: Record<string, string[] | undefined>,
): NextResponse {
  return NextResponse.json(
    { error, ...(fields ? { fields } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Actualiza una promoción, o alterna su estado activo/inactivo. */
export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonError("El identificador de la promoción no es válido.", 400);
  }

  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return jsonError("El cuerpo de la solicitud no es válido.", 400);
  }

  const adminClient = createAdminClient();

  const body =
    rawBody !== null && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};

  if (body.action === "toggle_enabled") {
    const { data: current, error: fetchError } = await adminClient
      .from("promotions")
      .select("enabled")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !current) {
      return jsonError("La promoción no existe.", 404);
    }

    const { error: updateError } = await adminClient
      .from("promotions")
      .update({ enabled: !current.enabled })
      .eq("id", id);

    if (updateError) {
      console.error("Error alternando promoción:", updateError);
      return jsonError("No se pudo actualizar la promoción.", 500);
    }

    await recordAuditEvent({
      actorUserId: adminUserId,
      action: current.enabled ? "disable_promotion" : "enable_promotion",
      entity: "promotions",
      entityId: id,
    });

    return NextResponse.json(
      { success: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  let input;

  try {
    input = promotionInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        "Los datos de la promoción no son válidos.",
        400,
        error.flatten().fieldErrors,
      );
    }

    throw error;
  }

  const { data: existing } = await adminClient
    .from("promotions")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return jsonError("La promoción no existe.", 404);
  }

  const { error: updateError } = await adminClient
    .from("promotions")
    .update({
      title: input.title,
      description: input.description,
      image_path: input.imagePath,
      cta_kind: input.ctaKind,
      cta_raffle_id: input.ctaKind === "raffle" ? input.ctaRaffleId : null,
      cta_url: input.ctaKind === "url" ? input.ctaUrl : null,
      cta_text: input.ctaText,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      enabled: input.enabled,
      display_order: input.displayOrder,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error actualizando promoción:", updateError);
    return jsonError("No se pudo actualizar la promoción.", 500);
  }

  /* La imagen anterior deja de usarse: se elimina para no acumular basura. */
  if (existing.image_path && existing.image_path !== input.imagePath) {
    await adminClient.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .remove([existing.image_path]);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "update_promotion",
    entity: "promotions",
    entityId: id,
    metadata: { title: input.title, cta_kind: input.ctaKind },
  });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

/** Elimina una promoción y limpia su foto en Storage. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonError("El identificador de la promoción no es válido.", 400);
  }

  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  const adminClient = createAdminClient();

  const { data: promotion } = await adminClient
    .from("promotions")
    .select("id, title, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) {
    return jsonError("La promoción no existe.", 404);
  }

  const { error } = await adminClient.from("promotions").delete().eq("id", id);

  if (error) {
    console.error("Error eliminando promoción:", error);
    return jsonError("No se pudo eliminar la promoción.", 500);
  }

  if (promotion.image_path) {
    await adminClient.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .remove([promotion.image_path]);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "delete_promotion",
    entity: "promotions",
    entityId: id,
    metadata: { title: promotion.title },
  });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
