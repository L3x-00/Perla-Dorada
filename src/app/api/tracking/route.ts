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
   * Rate limit antes de tocar la base: la combinación DNI + código es el
   * único secreto que protege esta consulta, así que se limita la fuerza
   * bruta. Falla en cerrado si no se puede comprobar.
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

  const result = data?.[0];

  /*
   * No indicamos si falló el DNI o el código por separado.
   */
  if (!result) {
    return NextResponse.json(
      {
        error:
          "No encontramos una solicitud con los datos ingresados.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  /*
   * Defensa adicional: aunque el RPC ya filtra los tickets, el endpoint
   * vuelve a garantizar que solo se devuelvan si la solicitud está
   * aprobada.
   */
  const ticketNumbers =
    result.request_status === "approved" ? result.ticket_numbers : [];

  return NextResponse.json(
    {
      request: {
        requestId: result.request_id,
        raffleName: result.raffle_name,
        status: result.request_status,
        expiresAt: result.expires_at,
        reviewedAt: result.reviewed_at,
        rejectionReason:
          result.request_status === "rejected"
            ? result.rejection_reason
            : null,
        ticketNumbers,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
