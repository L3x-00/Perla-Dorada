import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
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
      return {
        status: 403,
        error: "El administrador no está activo.",
      };

    case "TICKET_NOT_FOUND":
      return {
        status: 404,
        error: "El ticket no existe.",
      };

    case "PURCHASE_REQUEST_NOT_APPROVED":
      return {
        status: 409,
        error:
          "El ticket no pertenece a una solicitud aprobada.",
      };

    case "APP_SETTINGS_NOT_FOUND":
      return {
        status: 500,
        error:
          "No se encontró la configuración del sistema.",
      };

    case "MAX_REPRINTS_REACHED":
      return {
        status: 409,
        error:
          "Se alcanzó el máximo permitido de reimpresiones.",
      };

    case "REPRINT_REASON_REQUIRED":
      return {
        status: 400,
        error:
          "El motivo de reimpresión es obligatorio.",
      };

    case "REPRINT_REASON_TOO_LONG":
      return {
        status: 400,
        error:
          "El motivo no puede superar los 500 caracteres.",
      };

    default:
      return {
        status: 500,
        error:
          "No se pudo registrar la impresión.",
      };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      {
        error:
          "El identificador del ticket no es válido.",
      },
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
      {
        error:
          "El cuerpo de la solicitud no es válido.",
      },
      { status: 400 },
    );
  }

  const reason =
    typeof body.reason === "string"
      ? body.reason.trim()
      : undefined;

  if (reason && reason.length > 500) {
    return NextResponse.json(
      {
        error:
          "El motivo no puede superar los 500 caracteres.",
      },
      { status: 400 },
    );
  }

  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  const adminUserId = claimsData?.claims?.sub;

  if (claimsError || !adminUserId) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 },
    );
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc(
    "register_ticket_print",
    {
      p_admin_user_id: adminUserId,
      p_ticket_id: id,
      ...(reason
        ? {
            p_reason: reason,
          }
        : {}),
    },
  );

  if (error) {
    console.error("register_ticket_print failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    const mappedError = mapDatabaseError(
      error.message,
    );

    return NextResponse.json(
      {
        error: mappedError.error,
      },
      {
        status: mappedError.status,
      },
    );
  }

  const printResult = data?.[0];

  if (!printResult) {
    return NextResponse.json(
      {
        error:
          "La operación no produjo un registro de impresión.",
      },
      { status: 500 },
    );
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "ticket_print",
    entity: "tickets",
    entityId: id,
    metadata: {
      print_type: printResult.print_type,
      print_sequence: printResult.print_sequence,
    },
  });

  return NextResponse.json({
    success: true,
    print: printResult,
    printableUrl:
      `/admin/tickets/${printResult.ticket_id}/print` +
      `?printId=${printResult.print_id}`,
  });
}