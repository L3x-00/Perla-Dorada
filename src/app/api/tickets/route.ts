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
   * Comparte ámbito de rate limit con /api/tracking: ambos se validan por
   * DNI y no deben poder alternarse para duplicar la cuota. Falla en
   * cerrado.
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

  const { data, error } = await adminClient.rpc(
    "get_public_ticket_document",
    {
      p_document_type: input.documentType,
      p_dni: input.dni,
      p_tracking_code: input.trackingCode,
    },
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

  /*
   * El RPC solo devuelve filas de solicitudes aprobadas con tickets
   * asignados para ese DNI. Un mismo documento puede tener varias compras
   * aprobadas: se devuelven todas, más recientes primero.
   */
  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error:
          "No encontramos tickets disponibles para descargar con el documento ingresado.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      fullName: data[0].full_name,
      dni: data[0].dni,
      purchases: data.map((purchase) => ({
        requestId: purchase.request_id,
        raffleId: purchase.raffle_id,
        raffleName: purchase.raffle_name,
        purchasedAt: purchase.purchased_at,
        ticketStatus: purchase.ticket_status,
        ticketNumbers: purchase.ticket_numbers,
      })),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
