import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WinnerRequestBody = {
  ticketNumber?: unknown;
  prizeId?: unknown;
  location?: unknown;
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
  if (normalized.includes("PRIZE_ALREADY_HAS_WINNER")) {
    return {
      status: 409,
      error: "Este premio ya tiene un ganador registrado.",
    };
  }
  if (normalized.includes("RAFFLE_ALREADY_HAS_WINNER")) {
    return {
      status: 409,
      error: "Esta rifa ya tiene un ganador registrado.",
    };
  }
  if (normalized.includes("PRIZE_ID_REQUIRED")) {
    return {
      status: 400,
      error: "Debes indicar a qué premio corresponde este ganador.",
    };
  }
  if (normalized.includes("PRIZE_ID_NOT_ALLOWED")) {
    return {
      status: 400,
      error: "Esta rifa no tiene premios definidos; no indiques un premio.",
    };
  }
  if (normalized.includes("PRIZE_NOT_FOUND")) {
    return {
      status: 404,
      error: "El premio indicado no existe en esta rifa.",
    };
  }
  if (normalized.includes("TICKET_ALREADY_WINNER")) {
    return {
      status: 409,
      error: "Ese ticket ya fue registrado como ganador de otro premio.",
    };
  }
  if (normalized.includes("TICKET_NOT_ACTIVE")) {
    return {
      status: 409,
      error:
        "Ese ticket no está vigente (congelado, reasignado o anulado) y no puede ser ganador.",
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
  if (normalized.includes("INVALID_WINNER_LOCATION")) {
    return {
      status: 400,
      error: "La ciudad o distrito de compra no es válido.",
    };
  }

  return { status: 500, error: "No se pudo registrar el ganador." };
}

const UUID_PATTERN_PRIZE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (typeof body.location !== "string") {
    return NextResponse.json(
      { error: "La ciudad o distrito de compra es obligatorio." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const location = body.location.trim().replace(/\s+/g, " ");

  if (location.length < 2 || location.length > 120) {
    return NextResponse.json(
      { error: "La ciudad o distrito debe tener entre 2 y 120 caracteres." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let prizeId: string | null = null;

  if (body.prizeId !== undefined && body.prizeId !== null) {
    if (
      typeof body.prizeId !== "string" ||
      !UUID_PATTERN_PRIZE.test(body.prizeId)
    ) {
      return NextResponse.json(
        { error: "El identificador del premio no es válido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    prizeId = body.prizeId;
  }

  const adminClient = createAdminClient();

  const { data: winner, error } = await adminClient.rpc(
    "register_raffle_winner",
    {
      p_admin_user_id: adminUserId,
      p_raffle_id: id,
      p_ticket_number: ticketNumber,
      p_prize_id: prizeId ?? undefined,
      p_winner_location: location,
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

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "register_winner",
    entity: "raffle_winners",
    entityId: id,
    metadata: {
      ticket_number: ticketNumber,
      prize_id: prizeId,
    },
  });

  return NextResponse.json(
    { success: true, winner },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
