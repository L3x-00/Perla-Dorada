import { redirect } from "next/navigation";

import { TicketPrintAction } from "@/app/admin/ticket-print-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RaffleSummary = {
  id: string;
  name: string;
};

type PurchaseRequestSummary = {
  id: string;
  full_name: string;
  dni: string;
  status: string;
};

export default async function AdminTicketsPage() {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  if (
    claimsError ||
    !claimsData?.claims?.sub
  ) {
    redirect("/admin/login");
  }

  const adminClient = createAdminClient();

  const [
    ticketsResult,
    settingsResult,
  ] = await Promise.all([
    adminClient
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
      .order("assigned_at", {
        ascending: false,
      })
      .limit(200),

    adminClient
      .from("app_settings")
      .select("max_reprints")
      .limit(1)
      .maybeSingle(),
  ]);

  if (ticketsResult.error) {
    console.error(
      "Could not load tickets",
      ticketsResult.error,
    );

    throw new Error(
      "No se pudieron cargar los tickets.",
    );
  }

  if (
    settingsResult.error ||
    !settingsResult.data
  ) {
    console.error(
      "Could not load app settings",
      settingsResult.error,
    );

    throw new Error(
      "No se pudo cargar la configuración de reimpresiones.",
    );
  }

  const tickets = ticketsResult.data ?? [];
  const maxReprints =
    settingsResult.data.max_reprints;

  const raffleIds = [
    ...new Set(
      tickets.map((ticket) => ticket.raffle_id),
    ),
  ];

  const purchaseRequestIds = [
    ...new Set(
      tickets.map(
        (ticket) =>
          ticket.purchase_request_id,
      ),
    ),
  ];

  const ticketIds = tickets.map(
    (ticket) => ticket.id,
  );

  const [
    rafflesResult,
    purchaseRequestsResult,
    printsResult,
  ] = await Promise.all([
    raffleIds.length > 0
      ? adminClient
          .from("raffles")
          .select("id, name")
          .in("id", raffleIds)
      : Promise.resolve({
          data: [] as RaffleSummary[],
          error: null,
        }),

    purchaseRequestIds.length > 0
      ? adminClient
          .from("purchase_requests")
          .select(
            "id, full_name, dni, status",
          )
          .in("id", purchaseRequestIds)
      : Promise.resolve({
          data:
            [] as PurchaseRequestSummary[],
          error: null,
        }),

    ticketIds.length > 0
      ? adminClient
          .from("ticket_prints")
          .select("id, ticket_id")
          .in("ticket_id", ticketIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            ticket_id: string;
          }>,
          error: null,
        }),
  ]);

  if (
    rafflesResult.error ||
    purchaseRequestsResult.error ||
    printsResult.error
  ) {
    console.error("Ticket dependencies failed", {
      rafflesError:
        rafflesResult.error,
      requestsError:
        purchaseRequestsResult.error,
      printsError:
        printsResult.error,
    });

    throw new Error(
      "No se pudo cargar la información relacionada con los tickets.",
    );
  }

  const raffleById = new Map(
    (rafflesResult.data ?? []).map(
      (raffle) => [raffle.id, raffle],
    ),
  );

  const purchaseRequestById = new Map(
    (
      purchaseRequestsResult.data ?? []
    ).map((purchaseRequest) => [
      purchaseRequest.id,
      purchaseRequest,
    ]),
  );

  const printCountByTicketId =
    new Map<string, number>();

  for (const print of printsResult.data ?? []) {
    printCountByTicketId.set(
      print.ticket_id,
      (printCountByTicketId.get(
        print.ticket_id,
      ) ?? 0) + 1,
    );
  }

  return (
    <main className="p-6">
      <header>
        <h1 className="text-2xl font-bold">
          Tickets asignados
        </h1>

        <p className="mt-1 text-sm text-neutral-400">
          Impresión original y control de
          reimpresiones.
        </p>
      </header>

      {tickets.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 p-6">
          <p className="text-sm text-neutral-400">
            Todavía no existen tickets
            asignados.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-neutral-900">
              <tr>
                <th className="px-4 py-3">
                  Ticket
                </th>
                <th className="px-4 py-3">
                  Rifa
                </th>
                <th className="px-4 py-3">
                  Cliente
                </th>
                <th className="px-4 py-3">
                  DNI
                </th>
                <th className="px-4 py-3">
                  Asignado
                </th>
                <th className="px-4 py-3">
                  Impresiones
                </th>
                <th className="px-4 py-3">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => {
                const raffle =
                  raffleById.get(
                    ticket.raffle_id,
                  );

                const purchaseRequest =
                  purchaseRequestById.get(
                    ticket.purchase_request_id,
                  );

                const previousPrints =
                  printCountByTicketId.get(
                    ticket.id,
                  ) ?? 0;

                return (
                  <tr
                    key={ticket.id}
                    className="border-t border-neutral-800 align-top"
                  >
                    <td className="px-4 py-4 text-lg font-bold tabular-nums">
                      {String(
                        ticket.ticket_number,
                      ).padStart(4, "0")}
                    </td>

                    <td className="px-4 py-4">
                      {raffle?.name ??
                        "Rifa no encontrada"}
                    </td>

                    <td className="px-4 py-4">
                      {purchaseRequest?.full_name ??
                        "Solicitud no encontrada"}
                    </td>

                    <td className="px-4 py-4">
                      {purchaseRequest?.dni ??
                        "—"}
                    </td>

                    <td className="px-4 py-4">
                      {new Intl.DateTimeFormat(
                        "es-PE",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      ).format(
                        new Date(
                          ticket.assigned_at,
                        ),
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <p>
                        Total:{" "}
                        {previousPrints}
                      </p>

                      <p className="text-xs text-neutral-400">
                        Reimpresiones:{" "}
                        {Math.max(
                          previousPrints - 1,
                          0,
                        )}
                        /{maxReprints}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {purchaseRequest?.status ===
                      "approved" ? (
                        <TicketPrintAction
                          ticketId={ticket.id}
                          previousPrints={
                            previousPrints
                          }
                          maxReprints={
                            maxReprints
                          }
                        />
                      ) : (
                        <p className="text-xs text-red-400">
                          La solicitud no está
                          aprobada.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}