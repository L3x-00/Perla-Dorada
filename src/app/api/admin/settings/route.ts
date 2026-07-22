import { NextResponse } from "next/server";
import { z } from "zod";

import { appSettingsSchema } from "@/lib/settings/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  const adminUserId = claimsData?.claims?.sub;

  if (claimsError || typeof adminUserId !== "string") {
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
      max_reprints: input.maxReprints,
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

  /*
   * Auditoría: el registro no debe hacer fallar la operación si algo sale
   * mal (la configuración ya quedó guardada). Solo metadatos no sensibles.
   */
  const { error: auditError } = await adminClient.from("audit_log").insert({
    actor_user_id: adminUserId,
    action: "update_settings",
    entity: "app_settings",
    entity_id: null,
    metadata: {
      maintenance_mode: input.maintenanceMode,
      reservation_minutes: input.reservationMinutes,
      max_reprints: input.maxReprints,
      maintenance_message_set: input.maintenanceMessage !== null,
    },
  });

  if (auditError) {
    console.error(
      "No se pudo registrar la auditoría de configuración:",
      auditError,
    );
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
