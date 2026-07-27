import { NextResponse } from "next/server";

import { hasValidCronAuthorization } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Expiración global y periódica de reservas vencidas.
 *
 * Diseñado para ser invocado por Vercel Cron. Vercel adjunta el encabezado
 * `Authorization: Bearer <CRON_SECRET>` cuando la variable CRON_SECRET está
 * configurada en el proyecto; esta ruta lo exige.
 *
 * Nota: la disponibilidad ya ignora las reservas vencidas (se filtran por
 * expires_at > now() al leer y al crear/aprobar), por lo que esta tarea es
 * principalmente de higiene de estado: marca como `expired` las solicitudes
 * `pending` cuya reserva ya venció. Es idempotente.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    if (!hasValidCronAuthorization(request)) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    console.error("Cron de expiración sin configuración válida:", error);

    return NextResponse.json(
      { error: "El servicio no está configurado." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("expire_purchase_requests");

  if (error) {
    console.error("Error expirando solicitudes:", error);

    return NextResponse.json(
      { error: "No se pudo ejecutar la expiración." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, expired: data ?? 0 },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
