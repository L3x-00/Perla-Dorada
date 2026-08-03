import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { logError, logInfo } from "@/lib/observability/server-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestBody = {
  reason?: unknown;
  raffleId?: unknown;
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
        error: "La solicitud debe estar aprobada para imprimir sus tickets.",
      };
    case "PURCHASE_REQUEST_HAS_NO_TICKETS":
      return {
        status: 409,
        code: "PURCHASE_REQUEST_HAS_NO_TICKETS",
        error: "Esta solicitud todavía no tiene tickets asignados.",
      };
    case "TICKET_NOT_ACTIVE":
      return {
        status: 409,
        code: "TICKET_NOT_ACTIVE",
        error:
          "Uno o más tickets de esta solicitud están congelados o fueron reasignados y no se pueden imprimir.",
      };
    case "ACTIVE_TICKET_COUNT_MISMATCH":
      return {
        status: 409,
        code: "ACTIVE_TICKET_COUNT_MISMATCH",
        error:
          "Los tickets vigentes todavía no están completos. Finaliza su reasignación antes de imprimir.",
      };
    case "TICKET_GROUP_NOT_FOUND":
      return {
        status: 404,
        code: "TICKET_GROUP_NOT_FOUND",
        error: "No se encontró el grupo de tickets solicitado.",
      };
    case "TICKET_GROUP_NOT_PRINTABLE":
      return {
        status: 409,
        code: "TICKET_GROUP_NOT_PRINTABLE",
        error:
          "Solo se puede imprimir una tanda completa de una solicitud y una rifa. Finaliza cualquier reasignación pendiente.",
      };
    case "REPRINT_REASON_REQUIRED":
      return {
        status: 400,
        code: "REPRINT_REASON_REQUIRED",
        error: "El motivo de reimpresión es obligatorio.",
      };
    case "REPRINT_REASON_TOO_LONG":
      return {
        status: 400,
        code: "REPRINT_REASON_TOO_LONG",
        error: "El motivo no puede superar los 500 caracteres.",
      };
    default:
      return {
        status: 500,
        code: "PRINT_REGISTRATION_FAILED",
        error: "No se pudo registrar la impresión.",
      };
  }
}

/*
 * Registra e imprime, en una sola operación atómica, TODOS los tickets
 * activos de una solicitud aprobada. Reemplaza el flujo anterior de un
 * botón por ticket (torpe con solicitudes de decenas de tickets: un click
 * y una ventana emergente por cada uno). Sin límite de reimpresiones
 * (uso interno del panel para las ánforas del sorteo).
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

  let body: RequestBody = {};

  try {
    const rawBody = await request.text();
    if (rawBody) {
      body = JSON.parse(rawBody) as RequestBody;
    }
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  const raffleId =
    typeof body.raffleId === "string" ? body.raffleId.trim() : undefined;

  if (!raffleId || !UUID_PATTERN.test(raffleId)) {
    return NextResponse.json(
      { error: "El identificador de la rifa no es válido." },
      { status: 400 },
    );
  }

  if (reason && reason.length > 500) {
    return NextResponse.json(
      { error: "El motivo no puede superar los 500 caracteres." },
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
  const printResult = await adminClient.rpc("register_ticket_group_prints", {
    p_purchase_request_id: purchaseRequestId,
    p_raffle_id: raffleId,
    p_admin_user_id: adminUserId,
    ...(reason ? { p_reason: reason } : {}),
  });
  const { data, error } = printResult;

  if (error) {
    logError("ticket.print.batch_failed", error, {
      request_id: request.headers.get("x-request-id"),
      purchase_request_id: purchaseRequestId,
      raffle_id: raffleId,
      database_code: error.code,
    });
    const mapped = mapDatabaseError(error.message);

    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status },
    );
  }

  const prints = data ?? [];

  if (prints.length === 0) {
    logError(
      "ticket.print.batch_missing_result",
      new Error("La RPC no devolvió registros de impresión."),
      {
        request_id: request.headers.get("x-request-id"),
        purchase_request_id: purchaseRequestId,
        raffle_id: raffleId,
      },
    );
    return NextResponse.json(
      { error: "La operación no produjo ningún registro de impresión." },
      { status: 500 },
    );
  }

  const batchIds = new Set(prints.map((print) => print.batch_id));
  const batchId = prints[0].batch_id;

  if (
    batchIds.size !== 1 ||
    typeof batchId !== "string" ||
    !UUID_PATTERN.test(batchId)
  ) {
    logError(
      "ticket.print.batch_invalid_result",
      new Error("La RPC devolvió una tanda inconsistente."),
      {
        request_id: request.headers.get("x-request-id"),
        purchase_request_id: purchaseRequestId,
        raffle_id: raffleId,
      },
    );
    return NextResponse.json(
      {
        error:
          "La operación no produjo un identificador de impresión válido.",
      },
      { status: 500 },
    );
  }

  const originalCount = prints.filter(
    (print) => print.print_type === "original",
  ).length;
  const reprintCount = prints.length - originalCount;

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "ticket_print_batch_from_purchase_request",
    entity: "purchase_requests",
    entityId: purchaseRequestId,
    metadata: {
      ticket_count: prints.length,
      original_count: originalCount,
      reprint_count: reprintCount,
      batch_id: batchId,
      ...(raffleId ? { raffle_id: raffleId } : {}),
    },
  });

  logInfo("ticket.print.batch_registered", {
    request_id: request.headers.get("x-request-id"),
    purchase_request_id: purchaseRequestId,
    raffle_id: raffleId,
    ticket_count: prints.length,
    original_count: originalCount,
    reprint_count: reprintCount,
    batch_id: batchId,
  });

  const printQuery = new URLSearchParams({ batchId });

  return NextResponse.json({
    success: true,
    ticketCount: prints.length,
    printableUrl:
      `/admin/purchase-requests/${purchaseRequestId}/print?` +
      printQuery.toString(),
  });
}
