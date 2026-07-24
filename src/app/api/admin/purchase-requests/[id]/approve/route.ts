import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { mapPurchaseRequestActionError } from "@/lib/purchase-requests/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "El identificador no es válido." },
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
    "approve_purchase_request",
    {
      p_admin_user_id: adminUserId,
      p_purchase_request_id: id,
    },
  );

  if (error) {
    console.error("Error aprobando solicitud:", {
      code: error.code,
      message: error.message,
    });

    const mapped = mapPurchaseRequestActionError(
      error,
      "No se pudo aprobar la solicitud.",
    );

    return NextResponse.json(
      { error: mapped.message },
      { status: mapped.status },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "La solicitud no generó tickets." },
      { status: 409 },
    );
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "approve_purchase_request",
    entity: "purchase_requests",
    entityId: id,
    metadata: { ticket_count: data.length },
  });

  return NextResponse.json({
    success: true,
    tickets: data,
  });
}