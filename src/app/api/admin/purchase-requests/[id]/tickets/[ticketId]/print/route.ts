import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { logError, logInfo } from "@/lib/observability/server-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestBody = {
  reason?: unknown;
};

function mapDatabaseError(message: string) {
  switch (message) {
    case "ADMIN_NOT_ACTIVE":
      return { status: 403, error: "El administrador no está activo." };
    case "PURCHASE_REQUEST_NOT_FOUND":
    case "TICKET_NOT_FOUND":
      return { status: 404, error: "No se encontró el ticket solicitado." };
    case "PURCHASE_REQUEST_NOT_APPROVED":
      return {
        status: 409,
        error: "La solicitud debe estar aprobada para imprimir sus tickets.",
      };
    case "TICKET_DOES_NOT_BELONG_TO_PURCHASE_REQUEST":
      return { status: 409, error: "El ticket no pertenece a esta solicitud." };
    case "TICKET_NOT_ACTIVE":
      return {
        status: 409,
        error: "El ticket está congelado o fue reasignado y no se puede imprimir.",
      };
    case "REPRINT_REASON_REQUIRED":
      return { status: 400, error: "El motivo de reimpresión es obligatorio." };
    case "REPRINT_REASON_TOO_LONG":
      return { status: 400, error: "El motivo no puede superar los 500 caracteres." };
    default:
      return { status: 500, error: "No se pudo registrar la impresión." };
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; ticketId: string }>;
  },
) {
  const { id: purchaseRequestId, ticketId } = await params;

  if (!UUID_PATTERN.test(purchaseRequestId) || !UUID_PATTERN.test(ticketId)) {
    return NextResponse.json(
      { error: "El identificador de impresión no es válido." },
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

  const { data, error } = await createAdminClient().rpc(
    "register_purchase_request_ticket_print",
    {
      p_purchase_request_id: purchaseRequestId,
      p_ticket_id: ticketId,
      p_admin_user_id: adminUserId,
      ...(reason ? { p_reason: reason } : {}),
    },
  );

  if (error) {
    logError("ticket.print.unlimited_failed", error, {
      request_id: request.headers.get("x-request-id"),
      purchase_request_id: purchaseRequestId,
      ticket_id: ticketId,
      database_code: error.code,
    });
    const mapped = mapDatabaseError(error.message);

    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const printResult = data?.[0];

  if (!printResult) {
    logError(
      "ticket.print.unlimited_missing_result",
      new Error("La RPC no devolvió el registro de impresión."),
      {
        request_id: request.headers.get("x-request-id"),
        purchase_request_id: purchaseRequestId,
        ticket_id: ticketId,
      },
    );
    return NextResponse.json(
      { error: "La operación no produjo un registro de impresión." },
      { status: 500 },
    );
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "ticket_print_unlimited_from_purchase_request",
    entity: "tickets",
    entityId: ticketId,
    metadata: {
      purchase_request_id: purchaseRequestId,
      print_type: printResult.print_type,
      print_sequence: printResult.print_sequence,
    },
  });

  logInfo("ticket.print.unlimited_registered", {
    request_id: request.headers.get("x-request-id"),
    purchase_request_id: purchaseRequestId,
    ticket_id: ticketId,
    print_type: printResult.print_type,
    print_sequence: printResult.print_sequence,
  });

  return NextResponse.json({
    success: true,
    print: printResult,
    printableUrl:
      `/admin/tickets/${printResult.ticket_id}/print` +
      `?printId=${printResult.print_id}`,
  });
}
