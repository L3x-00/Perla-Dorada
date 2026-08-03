import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { appSettingsSchema } from "@/lib/settings/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request): Promise<NextResponse> {
  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let input;

  try {
    input = appSettingsSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Los datos de configuración no son válidos.",
          fields: error.flatten().fieldErrors,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    throw error;
  }

  const adminClient = createAdminClient();

  const { error: updateError } = await adminClient
    .from("app_settings")
    .update({
      maintenance_mode: input.maintenanceMode,
      reservation_minutes: input.reservationMinutes,
      maintenance_message: input.maintenanceMessage,
    })
    .eq("id", true);

  if (updateError) {
    console.error("Error actualizando configuración:", updateError);

    return NextResponse.json(
      { error: "No se pudo guardar la configuración." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "update_settings",
    entity: "app_settings",
    metadata: {
      maintenance_mode: input.maintenanceMode,
      reservation_minutes: input.reservationMinutes,
      maintenance_message_set: input.maintenanceMessage !== null,
    },
  });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
