import { NextResponse } from "next/server";

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
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET no está configurada.");

    return NextResponse.json(
      { error: "El servicio no está configurado." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
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
