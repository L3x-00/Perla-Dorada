import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { logError, logInfo } from "@/lib/observability/server-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

type RequestBody = {
  reason?: unknown;
};

function mapDatabaseError(message: string) {
  switch (message) {
    case "ADMIN_NOT_ACTIVE":
      return {
        status: 403,
        code: "ADMIN_NOT_ACTIVE",
        error: "El administrador no está activo.",
      };
    case "PURCHASE_REQUEST_NOT_FOUND":
      return {
        status: 404,
        code: "PURCHASE_REQUEST_NOT_FOUND",
        error: "No se encontró la solicitud.",
      };
    case "PURCHASE_REQUEST_NOT_APPROVED":
      return {
        status: 409,
        code: "PURCHASE_REQUEST_NOT_APPROVED",
        error: "Solo se puede anular una solicitud aprobada.",
      };
    case "RAFFLE_NOT_FOUND":
      return {
        status: 404,
        code: "RAFFLE_NOT_FOUND",
        error: "No se encontró la rifa asociada.",
      };
    case "RAFFLE_NOT_ACTIVE":
      return {
        status: 409,
        code: "RAFFLE_NOT_ACTIVE",
        error:
          "Solo se puede anular participación mientras la rifa está activa, antes del sorteo.",
      };
    case "NO_ACTIVE_TICKETS":
      return {
        status: 409,
        code: "NO_ACTIVE_TICKETS",
        error: "Esta solicitud no tiene tickets vigentes para anular.",
      };
    case "VOID_REASON_REQUIRED":
      return {
        status: 400,
        code: "VOID_REASON_REQUIRED",
        error: "El motivo de anulación es obligatorio.",
      };
    case "VOID_REASON_TOO_LONG":
      return {
        status: 400,
        code: "VOID_REASON_TOO_LONG",
        error: "El motivo no puede superar los 500 caracteres.",
      };
    default:
      return {
        status: 500,
        code: "VOID_FAILED",
        error: "No se pudo anular la participación.",
      };
  }
}

/*
 * Anula, de forma atómica, todos los tickets vigentes de una solicitud
 * aprobada (devolución de compra antes del sorteo, según las bases legales
 * del sorteo). No cancela la rifa ni afecta otras solicitudes.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: purchaseRequestId } = await params;

  if (!UUID_PATTERN.test(purchaseRequestId)) {
    return NextResponse.json(
      { error: "El identificador de la solicitud no es válido." },
      { status: 400 },
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  if (typeof body.reason !== "string") {
    return NextResponse.json(
      { error: "El motivo de anulación es obligatorio." },
      { status: 400 },
    );
  }

  const reason = body.reason.trim();

  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { error: "El motivo debe tener entre 5 y 500 caracteres." },
      { status: 400 },
    );
  }

  const sessionClient = await createClient();
  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();
  const adminUserId = claimsData?.claims?.sub;

  if (claimsError || !adminUserId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc(
    "void_purchase_request_tickets",
    {
      p_admin_user_id: adminUserId,
      p_purchase_request_id: purchaseRequestId,
      p_reason: reason,
    },
  );

  if (error) {
    logError("ticket.void.failed", error, {
      request_id: request.headers.get("x-request-id"),
      purchase_request_id: purchaseRequestId,
      database_code: error.code,
    });

    const mapped = mapDatabaseError(error.message);

    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status },
    );
  }

  const voided = data ?? [];

  /*
   * El motivo NO se copia aquí: es texto libre del admin y suele traer datos
   * del cliente. Ya queda guardado y auditado en tickets.void_reason junto al
   * actor y la fecha; duplicarlo en audit_log.metadata crearía una segunda
   * copia de PII que ningún proceso de retención purga, y contradiría tanto
   * el contrato de este módulo como al logger, que trata `reason` como clave
   * sensible.
   */
  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "void_purchase_request_tickets",
    entity: "purchase_requests",
    entityId: purchaseRequestId,
    metadata: {
      voided_ticket_count: voided.length,
    },
  });

  logInfo("ticket.void.registered", {
    request_id: request.headers.get("x-request-id"),
    purchase_request_id: purchaseRequestId,
    voided_ticket_count: voided.length,
  });

  return NextResponse.json({
    success: true,
    voidedTicketCount: voided.length,
  });
}
