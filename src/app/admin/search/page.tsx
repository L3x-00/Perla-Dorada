import { redirect } from "next/navigation";

import { TicketPrintAction } from "@/app/admin/ticket-print-action";
import {
  AdminPage,
  AdminPageHeader,
  btnPrimary,
} from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminSearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

type PurchaseRequestResult = {
  id: string;
  raffle_id: string;
  full_name: string;
  dni: string;
  status: string;
  tracking_code: string;
  created_at: string;
};

type TicketResult = {
  id: string;
  raffle_id: string;
  purchase_request_id: string;
  ticket_number: number;
  assigned_at: string;
};

type RaffleResult = {
  id: string;
  name: string;
};

type TicketPrintResult = {
  ticket_id: string;
};

function normalizeSearchTerm(
  value: string | string[] | undefined,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 50);
}

function sanitizeIlikeValue(value: string) {
  return value.replace(/[%_\\]/g, "");
}

function formatTicketNumber(
  ticketNumber: number,
) {
  return String(ticketNumber).padStart(
    4,
    "0",
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat(
    "es-PE",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    },
  ).format(date);
}

export default async function AdminSearchPage({
  searchParams,
}: AdminSearchPageProps) {
  const sessionClient =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await sessionClient.auth.getClaims();

  if (
    claimsError ||
    !claimsData?.claims?.sub
  ) {
    redirect("/admin/login");
  }

  const resolvedSearchParams =
    await searchParams;

  const query = normalizeSearchTerm(
    resolvedSearchParams.q,
  );

  const safeQuery =
    sanitizeIlikeValue(query);

  const adminClient =
    createAdminClient();

  let purchaseRequests: PurchaseRequestResult[] =
    [];

  let exactTickets: TicketResult[] = [];

  let tickets: TicketResult[] = [];

  let raffles: RaffleResult[] = [];

  let ticketPrints: TicketPrintResult[] =
    [];

  let maxReprints = 5;

  if (safeQuery.length >= 2) {
    const numericTicket =
      Number(safeQuery);

    const isValidTicketNumber =
      Number.isSafeInteger(
        numericTicket,
      ) && numericTicket > 0;

    const [
      requestsResult,
      exactTicketsResult,
      settingsResult,
    ] = await Promise.all([
      adminClient
        .from("purchase_requests")
        .select(
          `
            id,
            raffle_id,
            full_name,
            dni,
            status,
            tracking_code,
            created_at
          `,
        )
        .ilike(
          "dni",
          `%${safeQuery}%`,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(50),

      isValidTicketNumber
        ? adminClient
            .from("tickets")
            .select(
              `
                id,
                raffle_id,
                purchase_request_id,
                ticket_number,
                assigned_at
              `,
            )
            .eq(
              "ticket_number",
              numericTicket,
            )
            .order("assigned_at", {
              ascending: false,
            })
            .limit(50)
        : Promise.resolve({
            data: [] as TicketResult[],
            error: null,
          }),

      adminClient
        .from("app_settings")
        .select("max_reprints")
        .limit(1)
        .maybeSingle(),
    ]);

    if (
      requestsResult.error ||
      exactTicketsResult.error
    ) {
      console.error(
        "Admin search failed",
        {
          requestsError:
            requestsResult.error,
          ticketsError:
            exactTicketsResult.error,
        },
      );

      throw new Error(
        "No se pudo realizar la búsqueda.",
      );
    }

    if (settingsResult.error) {
      console.error(
        "Could not load max reprints",
        settingsResult.error,
      );

      throw new Error(
        "No se pudo cargar la configuración de reimpresiones.",
      );
    }

    purchaseRequests =
      requestsResult.data ?? [];

    exactTickets =
      exactTicketsResult.data ?? [];

    if (settingsResult.data) {
      maxReprints =
        settingsResult.data.max_reprints;
    }

    /*
     * Si se buscó un ticket, necesitamos
     * cargar también a su propietario.
     */
    const ownerRequestIds =
      exactTickets.map(
        (ticket) =>
          ticket.purchase_request_id,
      );

    const missingOwnerIds =
      ownerRequestIds.filter(
        (requestId) =>
          !purchaseRequests.some(
            (request) =>
              request.id === requestId,
          ),
      );

    if (missingOwnerIds.length > 0) {
      const {
        data: missingOwners,
        error: missingOwnersError,
      } = await adminClient
        .from("purchase_requests")
        .select(
          `
            id,
            raffle_id,
            full_name,
            dni,
            status,
            tracking_code,
            created_at
          `,
        )
        .in("id", missingOwnerIds);

      if (missingOwnersError) {
        console.error(
          "Could not load ticket owners",
          missingOwnersError,
        );

        throw new Error(
          "No se pudo cargar el propietario del ticket.",
        );
      }

      purchaseRequests = [
        ...purchaseRequests,
        ...(missingOwners ?? []),
      ];
    }

    /*
     * Cargamos todos los tickets de las
     * solicitudes encontradas.
     *
     * Esto permite que una búsqueda por DNI
     * muestre todos los tickets del cliente.
     *
     * Una búsqueda por ticket también muestra
     * los demás tickets de la misma solicitud.
     */
    const purchaseRequestIds = [
      ...new Set(
        purchaseRequests.map(
          (request) => request.id,
        ),
      ),
    ];

    if (purchaseRequestIds.length > 0) {
      const {
        data: relatedTickets,
        error: relatedTicketsError,
      } = await adminClient
        .from("tickets")
        .select(
          `
            id,
            raffle_id,
            purchase_request_id,
            ticket_number,
            assigned_at
          `,
        )
        .in(
          "purchase_request_id",
          purchaseRequestIds,
        )
        .order("ticket_number", {
          ascending: true,
        });

      if (relatedTicketsError) {
        console.error(
          "Could not load related tickets",
          relatedTicketsError,
        );

        throw new Error(
          "No se pudieron cargar los tickets relacionados.",
        );
      }

      tickets =
        relatedTickets ?? [];
    }

    /*
     * Defensa adicional: conservamos cualquier
     * ticket exacto aunque no aparezca en la
     * segunda consulta.
     */
    const ticketById = new Map<
      string,
      TicketResult
    >();

    for (const ticket of [
      ...tickets,
      ...exactTickets,
    ]) {
      ticketById.set(
        ticket.id,
        ticket,
      );
    }

    tickets = [
      ...ticketById.values(),
    ].sort(
      (left, right) =>
        left.ticket_number -
        right.ticket_number,
    );

    const raffleIds = [
      ...new Set(
        tickets.map(
          (ticket) =>
            ticket.raffle_id,
        ),
      ),
    ];

    const ticketIds =
      tickets.map(
        (ticket) => ticket.id,
      );

    const [
      rafflesResult,
      printsResult,
    ] = await Promise.all([
      raffleIds.length > 0
        ? adminClient
            .from("raffles")
            .select("id, name")
            .in("id", raffleIds)
        : Promise.resolve({
            data: [] as RaffleResult[],
            error: null,
          }),

      ticketIds.length > 0
        ? adminClient
            .from("ticket_prints")
            .select("ticket_id")
            .in(
              "ticket_id",
              ticketIds,
            )
        : Promise.resolve({
            data:
              [] as TicketPrintResult[],
            error: null,
          }),
    ]);

    if (
      rafflesResult.error ||
      printsResult.error
    ) {
      console.error(
        "Could not load search dependencies",
        {
          rafflesError:
            rafflesResult.error,
          printsError:
            printsResult.error,
        },
      );

      throw new Error(
        "No se pudo cargar la información relacionada.",
      );
    }

    raffles =
      rafflesResult.data ?? [];

    ticketPrints =
      printsResult.data ?? [];
  }

  const raffleById = new Map(
    raffles.map((raffle) => [
      raffle.id,
      raffle,
    ]),
  );

  const ticketsByRequestId =
    new Map<
      string,
      TicketResult[]
    >();

  for (const ticket of tickets) {
    const requestTickets =
      ticketsByRequestId.get(
        ticket.purchase_request_id,
      ) ?? [];

    requestTickets.push(ticket);

    ticketsByRequestId.set(
      ticket.purchase_request_id,
      requestTickets,
    );
  }

  const printCountByTicketId =
    new Map<string, number>();

  for (const print of ticketPrints) {
    printCountByTicketId.set(
      print.ticket_id,
      (printCountByTicketId.get(
        print.ticket_id,
      ) ?? 0) + 1,
    );
  }

  const hasSearch =
    safeQuery.length >= 2;

  const hasResults =
    purchaseRequests.length > 0;

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Buscar solicitudes y tickets"
        description="Busca por DNI parcial o completo, o por número exacto de ticket."
      />

      <form className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <label
          htmlFor="admin-search"
          className="sr-only"
        >
          DNI o número de ticket
        </label>

        <input
          id="admin-search"
          name="q"
          defaultValue={query}
          minLength={2}
          maxLength={50}
          placeholder="Ejemplo: 12345678 o 25"
          className="flex-1 rounded-lg border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
        />

        <button
          type="submit"
          className={btnPrimary}
        >
          Buscar
        </button>
      </form>

      {!query ? (
        <div className="mt-8 rounded-xl border border-line p-6 text-sm text-muted">
          Ingresa un DNI o número de ticket.
        </div>
      ) : null}

      {query &&
      safeQuery.length < 2 ? (
        <div className="mt-8 rounded-xl border border-amber-800/70 bg-amber-950/25 p-6 text-sm text-amber-200">
          Ingresa al menos dos caracteres.
        </div>
      ) : null}

      {hasSearch &&
      !hasResults ? (
        <div className="mt-8 rounded-xl border border-line p-6 text-sm text-muted">
          No se encontraron solicitudes ni
          tickets con ese criterio.
        </div>
      ) : null}

      {hasResults ? (
        <section className="mt-8 space-y-6">
          <p className="text-sm text-muted">
            Solicitudes encontradas:{" "}
            {purchaseRequests.length}
          </p>

          {purchaseRequests.map(
            (purchaseRequest) => {
              const requestTickets =
                ticketsByRequestId.get(
                  purchaseRequest.id,
                ) ?? [];

              return (
                <article
                  key={
                    purchaseRequest.id
                  }
                  className="rounded-2xl border border-line bg-ink p-6"
                >
                  <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {
                          purchaseRequest.full_name
                        }
                      </h2>

                      <p className="mt-2 text-sm text-muted">
                        DNI:{" "}
                        <span className="font-medium text-cream">
                          {
                            purchaseRequest.dni
                          }
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-muted">
                        Estado:{" "}
                        <span className="font-medium text-cream">
                          {
                            purchaseRequest.status
                          }
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-muted">
                        Código de seguimiento:{" "}
                        <span className="font-mono text-cream">
                          {
                            purchaseRequest.tracking_code
                          }
                        </span>
                      </p>
                    </div>

                    <p className="text-xs text-muted">
                      {formatDate(
                        purchaseRequest.created_at,
                      )}
                    </p>
                  </header>

                  <div className="mt-6 border-t border-line pt-6">
                    <h3 className="font-semibold">
                      Tickets asignados
                    </h3>

                    {requestTickets.length ===
                    0 ? (
                      <p className="mt-3 text-sm text-muted">
                        Esta solicitud todavía no
                        tiene tickets asignados.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {requestTickets.map(
                          (ticket) => {
                            const raffle =
                              raffleById.get(
                                ticket.raffle_id,
                              );

                            const previousPrints =
                              printCountByTicketId.get(
                                ticket.id,
                              ) ?? 0;

                            return (
                              <div
                                key={
                                  ticket.id
                                }
                                className="rounded-xl border border-line bg-ink-2 p-5"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <p className="text-2xl font-black tabular-nums">
                                      Ticket{" "}
                                      {formatTicketNumber(
                                        ticket.ticket_number,
                                      )}
                                    </p>

                                    <p className="mt-2 text-sm text-muted">
                                      Rifa:{" "}
                                      {raffle?.name ??
                                        "No encontrada"}
                                    </p>

                                    <p className="mt-1 text-xs text-muted">
                                      Asignado:{" "}
                                      {formatDate(
                                        ticket.assigned_at,
                                      )}
                                    </p>

                                    <p className="mt-2 text-xs text-muted">
                                      Impresiones:{" "}
                                      {previousPrints}
                                    </p>

                                    <p className="mt-1 text-xs text-muted">
                                      Reimpresiones:{" "}
                                      {Math.max(
                                        previousPrints -
                                          1,
                                        0,
                                      )}
                                      /{maxReprints}
                                    </p>
                                  </div>

                                  {purchaseRequest.status ===
                                  "approved" ? (
                                    <TicketPrintAction
                                      ticketId={
                                        ticket.id
                                      }
                                      previousPrints={
                                        previousPrints
                                      }
                                      maxReprints={
                                        maxReprints
                                      }
                                    />
                                  ) : (
                                    <p className="max-w-52 text-xs text-red-400">
                                      Solo se pueden
                                      imprimir tickets
                                      de solicitudes
                                      aprobadas.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </section>
      ) : null}
    </AdminPage>
  );
}