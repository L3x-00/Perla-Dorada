import { NextResponse } from "next/server";
import { z } from "zod";

import {
  PUBLIC_LOOKUP_RATE_LIMIT,
  checkRateLimit,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackingLookupSchema } from "@/lib/validation/tracking";

export async function POST(request: Request): Promise<NextResponse> {
  /*
   * Rate limit antes de tocar la base: el DNI es el único dato que protege
   * esta consulta, así que se limita la fuerza bruta. Falla en cerrado si
   * no se puede comprobar.
   */
  try {
    const rateLimit = await checkRateLimit(
      request,
      PUBLIC_LOOKUP_RATE_LIMIT,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Has realizado demasiadas consultas. Inténtalo nuevamente más tarde.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  } catch (error) {
    console.error("Error ejecutando protección antiabuso:", error);

    return NextResponse.json(
      { error: "El servicio no está disponible temporalmente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let input;

  try {
    input = trackingLookupSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ?? "Los datos enviados no son válidos.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    throw error;
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc("track_purchase_request", {
    p_document_type: input.documentType,
    p_dni: input.dni,
    p_tracking_code: input.trackingCode,
  });

  if (error) {
    console.error("track_purchase_request failed", {
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { error: "No se pudo consultar la solicitud." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  /*
   * Un mismo DNI puede tener varias solicitudes (no hay límite de una
   * pendiente por documento). Se devuelven todas, más recientes primero.
   */
  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error:
          "No encontramos solicitudes con el documento ingresado.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  /*
   * Se expone solo la CANTIDAD de tickets vigentes, no sus números: aquí la
   * consulta es de estado. El RPC ya filtra por ticket_status = 'active', así
   * que una solicitud aprobada cuyos tickets fueron anulados (o congelados)
   * llega con 0 y la pantalla deja de prometer una descarga que no existe.
   */
  const requests = data.map((result) => ({
    requestId: result.request_id,
    raffleName: result.raffle_name,
    status: result.request_status,
    requestedAt: result.requested_at,
    expiresAt: result.expires_at,
    reviewedAt: result.reviewed_at,
    activeTicketCount: Array.isArray(result.ticket_numbers)
      ? result.ticket_numbers.length
      : 0,
    rejectionReason:
      result.request_status === "rejected" ? result.rejection_reason : null,
  }));

  return NextResponse.json(
    { requests },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
