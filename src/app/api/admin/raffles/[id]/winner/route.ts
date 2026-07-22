import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WinnerRequestBody = {
  ticketNumber?: unknown;
};

function mapWinnerError(message: string): {
  status: number;
  error: string;
} {
  const normalized = message.toUpperCase();

  if (normalized.includes("ADMIN_NOT_ACTIVE")) {
    return { status: 403, error: "No tienes permisos de administrador activo." };
  }
  if (normalized.includes("RAFFLE_NOT_FOUND")) {
    return { status: 404, error: "La rifa no existe." };
  }
  if (normalized.includes("RAFFLE_NOT_CLOSED")) {
    return {
      status: 409,
      error: "La rifa debe estar cerrada para registrar un ganador.",
    };
  }
  if (normalized.includes("RAFFLE_ALREADY_HAS_WINNER")) {
    return {
      status: 409,
      error: "Esta rifa ya tiene un ganador registrado.",
    };
  }
  if (normalized.includes("TICKET_NOT_FOUND")) {
    return {
      status: 404,
      error: "No existe un ticket con ese número en esta rifa.",
    };
  }
  if (normalized.includes("INVALID_TICKET_NUMBER")) {
    return { status: 400, error: "El número de ticket no es válido." };
  }

  return { status: 500, error: "No se pudo registrar el ganador." };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "El identificador de la rifa no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  const adminUserId = claimsData?.claims?.sub;

  if (claimsError || typeof adminUserId !== "string") {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: WinnerRequestBody;

  try {
    body = (await request.json()) as WinnerRequestBody;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ticketNumber = Number(body.ticketNumber);

  if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
    return NextResponse.json(
      { error: "El número de ticket no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const adminClient = createAdminClient();

  const { data: winner, error } = await adminClient.rpc(
    "register_raffle_winner",
    {
      p_admin_user_id: adminUserId,
      p_raffle_id: id,
      p_ticket_number: ticketNumber,
    },
  );

  if (error) {
    console.error("register_raffle_winner failed", {
      code: error.code,
      message: error.message,
    });

    const mapped = mapWinnerError(error.message);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error: auditError } = await adminClient.from("audit_log").insert({
    actor_user_id: adminUserId,
    action: "register_winner",
    entity: "raffle_winners",
    entity_id: id,
    metadata: { ticket_number: ticketNumber },
  });

  if (auditError) {
    console.error(
      "No se pudo registrar la auditoría del ganador:",
      auditError,
    );
  }

  return NextResponse.json(
    { success: true, winner },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
