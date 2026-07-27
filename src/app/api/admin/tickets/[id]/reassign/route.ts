import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();

const reassignSchema = z.object({
  targetRaffleId: uuidSchema,
});

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function mapDatabaseError(message: string) {
  switch (message) {
    case "SOURCE_TICKET_NOT_FOUND":
      return { error: "El ticket no existe.", status: 404 };
    case "SOURCE_TICKET_NOT_FROZEN":
      return { error: "Solo se pueden reasignar tickets congelados.", status: 409 };
    case "SOURCE_RAFFLE_NOT_CANCELLED":
      return { error: "El ticket no corresponde a una rifa cancelada.", status: 409 };
    case "TARGET_RAFFLE_NOT_FOUND":
      return { error: "La rifa de destino no existe.", status: 404 };
    case "TARGET_RAFFLE_NOT_ACTIVE":
      return { error: "La rifa de destino debe estar activa.", status: 409 };
    case "TARGET_RAFFLE_SOLD_OUT":
      return { error: "La rifa de destino ya no tiene tickets disponibles.", status: 409 };
    case "TARGET_RAFFLE_MUST_DIFFER":
      return { error: "La rifa de destino debe ser distinta.", status: 400 };
    case "ADMIN_NOT_ACTIVE":
      return { error: "El administrador no está activo.", status: 403 };
    default:
      return { error: "No se pudo reasignar el ticket.", status: 500 };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return jsonError("El identificador del ticket no es válido.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("El cuerpo de la solicitud no es válido.", 400);
  }

  const parsed = reassignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("La rifa de destino no es válida.", 400);
  }

  const adminUserId = await requireActiveAdmin();
  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("reassign_frozen_ticket", {
    p_admin_user_id: adminUserId,
    p_source_ticket_id: id,
    p_target_raffle_id: parsed.data.targetRaffleId,
  });

  if (error) {
    console.error("reassign_frozen_ticket failed", {
      code: error.code,
      message: error.message,
    });
    const mapped = mapDatabaseError(error.message);
    return jsonError(mapped.error, mapped.status);
  }

  const reassignment = data?.[0];
  if (!reassignment) {
    return jsonError("La reasignación no produjo un ticket nuevo.", 500);
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "reassign_frozen_ticket",
    entity: "tickets",
    entityId: id,
    metadata: {
      target_raffle_id: parsed.data.targetRaffleId,
      reassigned_ticket_id: reassignment.reassigned_ticket_id,
      reassigned_ticket_number: reassignment.reassigned_ticket_number,
    },
  });

  return NextResponse.json(
    {
      success: true,
      reassignedTicketId: reassignment.reassigned_ticket_id,
      reassignedTicketNumber: reassignment.reassigned_ticket_number,
      targetRaffleName: reassignment.target_raffle_name,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
