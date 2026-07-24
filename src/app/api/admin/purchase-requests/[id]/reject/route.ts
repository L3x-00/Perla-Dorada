import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { mapPurchaseRequestActionError } from "@/lib/purchase-requests/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type RejectRequestBody = {
  reason?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "El identificador no es válido." },
      { status: 400 },
    );
  }

  let body: RejectRequestBody;

  try {
    body = (await request.json()) as RejectRequestBody;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  if (typeof body.reason !== "string") {
    return NextResponse.json(
      { error: "El motivo de rechazo es obligatorio." },
      { status: 400 },
    );
  }

  const reason = body.reason.trim();

  if (
    reason.length < MIN_REASON_LENGTH ||
    reason.length > MAX_REASON_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          "El motivo debe tener entre 5 y 500 caracteres.",
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
    "reject_purchase_request",
    {
      p_admin_user_id: adminUserId,
      p_purchase_request_id: id,
      p_rejection_reason: reason,
    },
  );

  if (error) {
    console.error("Error rechazando solicitud:", {
      code: error.code,
      message: error.message,
    });

    const mapped = mapPurchaseRequestActionError(
      error,
      "No se pudo rechazar la solicitud.",
    );

    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "reject_purchase_request",
    entity: "purchase_requests",
    entityId: id,
  });

  return NextResponse.json({
    success: true,
    purchaseRequest: data,
  });
}