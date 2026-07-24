import { NextResponse } from "next/server";

import { PAYMENT_PROOFS_BUCKET } from "@/config/storage";
import { recordAuditEvent } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 15;

/*
 * Retención de comprobantes: elimina de Storage los comprobantes de
 * solicitudes cuya rifa cerró/canceló hace >= 15 días y marca
 * payment_proof_deleted_at. Idempotente (solo procesa los no marcados).
 * Conserva la solicitud, tickets y ganador. Protegida por CRON_SECRET.
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

  const { data: candidates, error } = await supabase.rpc(
    "list_payment_proofs_for_retention",
    { p_retention_days: RETENTION_DAYS },
  );

  if (error) {
    console.error("Error listando comprobantes para retención:", error);

    return NextResponse.json(
      { error: "No se pudo ejecutar la retención." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let processed = 0;
  let failed = 0;

  for (const candidate of candidates ?? []) {
    const { error: removeError } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .remove([candidate.payment_proof_path]);

    if (removeError) {
      console.error("Retención: no se pudo eliminar el comprobante", {
        requestId: candidate.request_id,
        message: removeError.message,
      });
      failed += 1;
      continue;
    }

    const { error: markError } = await supabase
      .from("purchase_requests")
      .update({ payment_proof_deleted_at: new Date().toISOString() })
      .eq("id", candidate.request_id)
      .is("payment_proof_deleted_at", null);

    if (markError) {
      console.error("Retención: no se pudo marcar como eliminado", {
        requestId: candidate.request_id,
        message: markError.message,
      });
      failed += 1;
      continue;
    }

    processed += 1;
  }

  /*
   * Higiene de la tabla de rate limiting: se borra en el mismo paso diario
   * para no acumular ventanas ya vencidas. Un fallo aquí no debe abortar la
   * retención de comprobantes, así que solo se registra.
   */
  let purgedRateLimits = 0;

  const { data: purged, error: purgeError } = await supabase.rpc(
    "purge_rate_limits",
    { p_retention_days: 2 },
  );

  if (purgeError) {
    console.error("Error purgando rate limits:", purgeError);
  } else {
    purgedRateLimits = purged ?? 0;
  }

  await recordAuditEvent({
    actorUserId: null,
    action: "payment_proof_retention",
    entity: "purchase_requests",
    metadata: { processed, failed, purged_rate_limits: purgedRateLimits },
  });

  return NextResponse.json(
    { ok: true, processed, failed, purgedRateLimits },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
