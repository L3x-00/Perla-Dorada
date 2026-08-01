import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { promotionInputSchema } from "@/lib/promotions/validation";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Crea una promoción. */
export async function POST(request: Request): Promise<NextResponse> {
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

  let input;

  try {
    input = promotionInputSchema.parse(rawBody);
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

  const adminClient = createAdminClient();

  const { data: promotion, error } = await adminClient
    .from("promotions")
    .insert({
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
    .select("id")
    .single();

  if (error) {
    console.error("Error creando promoción:", {
      code: error.code,
      message: error.message,
    });

    return jsonError("No se pudo crear la promoción.", 500);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "create_promotion",
    entity: "promotions",
    entityId: promotion.id,
    metadata: { title: input.title, cta_kind: input.ctaKind },
  });

  return NextResponse.json(
    { success: true, promotion: { id: promotion.id } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
