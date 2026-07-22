import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type TrackingRequestBody = {
  dni?: unknown;
  trackingCode?: unknown;
};

const DNI_PATTERN = /^[0-9A-Za-z-]{6,20}$/;
const TRACKING_CODE_PATTERN = /^[0-9A-Z-]{6,40}$/;

function normalizeDni(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, "");
}

function normalizeTrackingCode(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export async function POST(request: Request) {
  let body: TrackingRequestBody;

  try {
    body =
      (await request.json()) as TrackingRequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "El cuerpo de la solicitud no es válido.",
      },
      { status: 400 },
    );
  }

  const dni = normalizeDni(body.dni);

  const trackingCode =
    normalizeTrackingCode(
      body.trackingCode,
    );

  if (!DNI_PATTERN.test(dni)) {
    return NextResponse.json(
      {
        error: "El DNI no es válido.",
      },
      { status: 400 },
    );
  }

  if (
    !TRACKING_CODE_PATTERN.test(
      trackingCode,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "El código de seguimiento no es válido.",
      },
      { status: 400 },
    );
  }

  const adminClient =
    createAdminClient();

  const { data, error } =
    await adminClient.rpc(
      "track_purchase_request",
      {
        p_dni: dni,
        p_tracking_code:
          trackingCode,
      },
    );

  if (error) {
    console.error(
      "track_purchase_request failed",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    return NextResponse.json(
      {
        error:
          "No se pudo consultar la solicitud.",
      },
      { status: 500 },
    );
  }

  const result = data?.[0];

  /*
   * No indicamos si falló el DNI o el
   * código por separado.
   */
  if (!result) {
    return NextResponse.json(
      {
        error:
          "No encontramos una solicitud con los datos ingresados.",
      },
      { status: 404 },
    );
  }

  /*
   * Defensa adicional: aunque el RPC ya
   * filtra los tickets, el endpoint vuelve
   * a garantizar que solo se devuelvan si
   * la solicitud está aprobada.
   */
  const ticketNumbers =
    result.request_status ===
    "approved"
      ? result.ticket_numbers
      : [];

  return NextResponse.json({
    request: {
      requestId:
        result.request_id,
      raffleName:
        result.raffle_name,
      status:
        result.request_status,
      expiresAt:
        result.expires_at,
      reviewedAt:
        result.reviewed_at,
      rejectionReason:
        result.request_status ===
        "rejected"
          ? result.rejection_reason
          : null,
      ticketNumbers,
    },
  });
}