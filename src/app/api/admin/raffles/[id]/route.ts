import { NextResponse } from "next/server";

import {
  isRaffleAction,
  type RaffleAction,
} from "@/lib/raffles/actions";
import { mapRaffleDatabaseError } from "@/lib/raffles/errors";
import {
  parseRaffleInput,
  type RaffleInput,
} from "@/lib/raffles/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = Record<string, unknown>;

type SuccessResponse = {
  success: true;
};

type ErrorResponse = {
  success?: false;
  error: string;
};

type RouteResponse = SuccessResponse | ErrorResponse;

type AdminClient = ReturnType<typeof createAdminClient>;

type DatabaseError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function jsonError(
  error: string,
  status: number,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error,
    },
    {
      status,
    },
  );
}

function jsonSuccess(): NextResponse<SuccessResponse> {
  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}

function logDatabaseError(
  action: RaffleAction,
  error: DatabaseError,
): void {
  console.error(`raffle ${action} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function databaseErrorResponse(
  action: RaffleAction,
  error: DatabaseError,
): NextResponse<ErrorResponse> {
  logDatabaseError(action, error);

  const mappedError = mapRaffleDatabaseError(
    error.message,
  );

  return jsonError(
    mappedError.message,
    mappedError.status,
  );
}

async function updateRaffle(
  adminClient: AdminClient,
  adminUserId: string,
  raffleId: string,
  body: RequestBody,
): Promise<NextResponse<RouteResponse>> {
  let input: RaffleInput;

  try {
    input = parseRaffleInput(body);
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Los datos de la rifa no son válidos.",
      400,
    );
  }

  /*
   * Supabase puede generar algunos parámetros timestamptz
   * como string aunque la función PostgreSQL acepte NULL.
   * El cast mantiene la llamada alineada con la firma RPC.
   */
  const rpcArguments = {
    p_admin_user_id: adminUserId,
    p_raffle_id: raffleId,
    p_name: input.name,
    p_description: input.description,
    p_ticket_price: input.ticketPrice,
    p_total_tickets: input.totalTickets,
    p_starts_at: input.startsAt,
    p_closes_at: input.closesAt,
    p_draw_at: input.drawAt,
  } as unknown as Database["public"]["Functions"]["update_raffle"]["Args"];

  const { error } = await adminClient.rpc(
    "update_raffle",
    rpcArguments,
  );

  if (error) {
    return databaseErrorResponse(
      "update",
      error,
    );
  }

  return jsonSuccess();
}

async function activateRaffle(
  adminClient: AdminClient,
  adminUserId: string,
  raffleId: string,
): Promise<NextResponse<RouteResponse>> {
  const rpcArguments = {
    p_admin_user_id: adminUserId,
    p_raffle_id: raffleId,
  } satisfies Database["public"]["Functions"]["activate_raffle"]["Args"];

  const { error } = await adminClient.rpc(
    "activate_raffle",
    rpcArguments,
  );

  if (error) {
    return databaseErrorResponse(
      "activate",
      error,
    );
  }

  return jsonSuccess();
}

async function closeRaffle(
  adminClient: AdminClient,
  adminUserId: string,
  raffleId: string,
): Promise<NextResponse<RouteResponse>> {
  const rpcArguments = {
    p_admin_user_id: adminUserId,
    p_raffle_id: raffleId,
  } satisfies Database["public"]["Functions"]["close_raffle"]["Args"];

  const { error } = await adminClient.rpc(
    "close_raffle",
    rpcArguments,
  );

  if (error) {
    return databaseErrorResponse(
      "close",
      error,
    );
  }

  return jsonSuccess();
}

async function cancelRaffle(
  adminClient: AdminClient,
  adminUserId: string,
  raffleId: string,
): Promise<NextResponse<RouteResponse>> {
  const rpcArguments = {
    p_admin_user_id: adminUserId,
    p_raffle_id: raffleId,
  } satisfies Database["public"]["Functions"]["cancel_raffle"]["Args"];

  const { error } = await adminClient.rpc(
    "cancel_raffle",
    rpcArguments,
  );

  if (error) {
    return databaseErrorResponse(
      "cancel",
      error,
    );
  }

  return jsonSuccess();
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<RouteResponse>> {
  const { id: raffleId } =
    await context.params;

  if (!isValidUuid(raffleId)) {
    return jsonError(
      "El identificador de la rifa no es válido.",
      400,
    );
  }

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
    return jsonError(
      "No autorizado.",
      401,
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return jsonError(
      "El cuerpo de la solicitud no contiene JSON válido.",
      400,
    );
  }

  if (
    rawBody === null ||
    typeof rawBody !== "object" ||
    Array.isArray(rawBody)
  ) {
    return jsonError(
      "El cuerpo de la solicitud no es válido.",
      400,
    );
  }

  const body =
    rawBody as RequestBody;

  const action = body.action;

  if (!isRaffleAction(action)) {
    return jsonError(
      "La acción solicitada no es válida.",
      400,
    );
  }

  const adminClient =
    createAdminClient();

  switch (action) {
    case "update":
      return updateRaffle(
        adminClient,
        adminUserId,
        raffleId,
        body,
      );

    case "activate":
      return activateRaffle(
        adminClient,
        adminUserId,
        raffleId,
      );

    case "close":
      return closeRaffle(
        adminClient,
        adminUserId,
        raffleId,
      );

    case "cancel":
      return cancelRaffle(
        adminClient,
        adminUserId,
        raffleId,
      );
  }
}