import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type TicketsRequestBody = {
  dni?: unknown;
  trackingCode?: unknown;
};

const DNI_PATTERN = /^[0-9A-Za-z-]{6,20}$/;
const TRACKING_CODE_PATTERN = /^[0-9A-Z-]{6,40}$/;

function normalizeDni(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, "");
}

function normalizeTrackingCode(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: TicketsRequestBody;

  try {
    body = (await request.json()) as TicketsRequestBody;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dni = normalizeDni(body.dni);
  const trackingCode = normalizeTrackingCode(body.trackingCode);

  if (!DNI_PATTERN.test(dni)) {
    return NextResponse.json(
      { error: "El DNI no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!TRACKING_CODE_PATTERN.test(trackingCode)) {
    return NextResponse.json(
      { error: "El código de seguimiento no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc(
    "get_public_ticket_document",
    { p_dni: dni, p_tracking_code: trackingCode },
  );

  if (error) {
    console.error("get_public_ticket_document failed", {
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { error: "No se pudo obtener los tickets." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const document = data?.[0];

  /*
   * El RPC solo devuelve filas para solicitudes aprobadas con DNI +
   * tracking_code correctos. Cualquier otro caso (pendiente, rechazada,
   * inexistente, ajena) llega aquí como vacío → 404 genérico.
   */
  if (!document || document.ticket_numbers.length === 0) {
    return NextResponse.json(
      {
        error:
          "No encontramos tickets disponibles para descargar con los datos ingresados.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      document: {
        raffleName: document.raffle_name,
        raffleDescription: document.raffle_description,
        drawAt: document.draw_at,
        ticketPrice: document.ticket_price,
        fullName: document.full_name,
        dni: document.dni,
        trackingCode: document.tracking_code,
        ticketNumbers: document.ticket_numbers,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
