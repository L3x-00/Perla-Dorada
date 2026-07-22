import { NextResponse } from "next/server";

import { mapRaffleDatabaseError } from "@/lib/raffles/errors";
import { parseRaffleInput } from "@/lib/raffles/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
type CreateRaffleResponse =
  | {
      success: true;
      raffle: {
        id: string;
      };
    }
  | {
      success?: false;
      error: string;
    };

export async function POST(
  request: Request,
): Promise<
  NextResponse<CreateRaffleResponse>
> {
  const sessionClient =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await sessionClient.auth.getClaims();

  const adminUserId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    typeof adminUserId !== "string"
  ) {
    return NextResponse.json(
      {
        error: "No autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "El cuerpo de la solicitud no contiene JSON válido.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    rawBody === null ||
    typeof rawBody !== "object" ||
    Array.isArray(rawBody)
  ) {
    return NextResponse.json(
      {
        error:
          "El cuerpo de la solicitud no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  let input;

  try {
    input = parseRaffleInput(
        rawBody as Record<string, unknown>,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Los datos de la rifa no son válidos.",
      },
      {
        status: 400,
      },
    );
  }

  const adminClient =
  createAdminClient();

const rpcArguments = {
  p_admin_user_id: adminUserId,
  p_name: input.name,
  p_description: input.description,
  p_ticket_price: input.ticketPrice,
  p_total_tickets: input.totalTickets,
  p_starts_at: input.startsAt,
  p_closes_at: input.closesAt,
  p_draw_at: input.drawAt,
} as unknown as Database["public"]["Functions"]["create_raffle"]["Args"];

const {
  data: raffle,
  error: databaseError,
} = await adminClient.rpc(
  "create_raffle",
  rpcArguments,
);

  if (databaseError) {
    console.error(
      "create_raffle failed",
      {
        code: databaseError.code,
        message:
          databaseError.message,
        details:
          databaseError.details,
        hint: databaseError.hint,
      },
    );

    const mappedError =
      mapRaffleDatabaseError(
        databaseError.message,
      );

    return NextResponse.json(
      {
        error:
          mappedError.message,
      },
      {
        status:
          mappedError.status,
      },
    );
  }

  /*
   * Los RPC que retornan un tipo compuesto
   * pueden aparecer como objeto o como arreglo,
   * dependiendo de la firma generada por Supabase.
   */
  const createdRaffle =
    Array.isArray(raffle)
      ? raffle[0]
      : raffle;

  if (
    !createdRaffle ||
    typeof createdRaffle.id !==
      "string"
  ) {
    console.error(
      "create_raffle returned an invalid result",
      {
        raffle,
      },
    );

    return NextResponse.json(
      {
        error:
          "La base de datos no devolvió la rifa creada.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      raffle: {
        id: createdRaffle.id,
      },
    },
    {
      status: 201,
    },
  );
}