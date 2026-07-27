import { redirect } from "next/navigation";

import { TicketReassignAction } from "@/app/admin/ticket-reassign-action";
import { TicketPrintAction } from "@/app/admin/ticket-print-action";
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
} from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
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
    activeRafflesResult,
  ] = await Promise.all([
    adminClient
      .from("tickets")
      .select(
        `
          id,
          raffle_id,
          purchase_request_id,
          ticket_number,
          ticket_status,
          origin_ticket_id,
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

    adminClient
      .from("raffles")
      .select("id, name")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
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
    !settingsResult.data ||
    activeRafflesResult.error
  ) {
    console.error("Could not load ticket settings", {
      settingsError: settingsResult.error,
      activeRafflesError: activeRafflesResult.error,
    });

    throw new Error(
      "No se pudo cargar la configuración de reimpresiones.",
    );
  }

  const tickets = ticketsResult.data ?? [];
  const maxReprints =
    settingsResult.data.max_reprints;
  const activeRaffles = activeRafflesResult.data ?? [];

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

  const rows = tickets.map((ticket) => ({
    ticket,
    raffleName: raffleById.get(ticket.raffle_id)?.name ?? "Rifa no encontrada",
    request: purchaseRequestById.get(ticket.purchase_request_id),
    previousPrints: printCountByTicketId.get(ticket.id) ?? 0,
  }));

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Tickets asignados"
        description="Impresión, reimpresiones y reasignación trazable de tickets congelados. Se muestran los 200 más recientes."
      />

      {tickets.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Sin tickets"
            description="Todavía no existen tickets asignados."
          />
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="mt-8 space-y-3 lg:hidden">
            {rows.map(({ ticket, raffleName, request, previousPrints }, i) => (
              <article
                key={ticket.id}
                className="rise-in rounded-xl border border-line bg-ink-2 p-4"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-3xl font-light tabular-nums text-cream">
                      {String(ticket.ticket_number).padStart(4, "0")}
                    </p>
                    <p className="mt-1 truncate text-sm text-cream">
                      {request?.full_name ?? "Solicitud no encontrada"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      DNI {request?.dni ?? "—"} · {raffleName}
                    </p>
                    <div className="mt-2">
                      <TicketStatusBadge status={ticket.ticket_status} />
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                      Asignado
                    </dt>
                    <dd className="mt-1 text-cream">
                      {formatDateTime(ticket.assigned_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                      Reimpresiones
                    </dt>
                    <dd className="mt-1 text-cream">
                      {Math.max(previousPrints - 1, 0)}/{maxReprints}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-line pt-4">
                  {request?.status === "approved" &&
                  ticket.ticket_status === "active" ? (
                    <TicketPrintAction
                      ticketId={ticket.id}
                      previousPrints={previousPrints}
                      maxReprints={maxReprints}
                    />
                  ) : ticket.ticket_status === "frozen" ? (
                    <TicketReassignAction
                      ticketId={ticket.id}
                      activeRaffles={activeRaffles}
                    />
                  ) : ticket.ticket_status === "reassigned" ? (
                    <p className="text-xs text-muted">
                      Reasignado: se conserva solo como historial.
                    </p>
                  ) : (
                    <p className="text-xs text-red-400">
                      La solicitud no está aprobada.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <div className="mt-8 hidden overflow-x-auto rounded-xl border border-line lg:block">
            <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-ink-2">
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
                  Estado
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
                    className="border-t border-line align-top"
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
                      {formatDateTime(ticket.assigned_at)}
                    </td>

                    <td className="px-4 py-4">
                      <TicketStatusBadge status={ticket.ticket_status} />
                    </td>

                    <td className="px-4 py-4">
                      <p>
                        Total:{" "}
                        {previousPrints}
                      </p>

                      <p className="text-xs text-muted">
                        Reimpresiones:{" "}
                        {Math.max(
                          previousPrints - 1,
                          0,
                        )}
                        /{maxReprints}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {purchaseRequest?.status === "approved" &&
                      ticket.ticket_status === "active" ? (
                        <TicketPrintAction
                          ticketId={ticket.id}
                          previousPrints={
                            previousPrints
                          }
                          maxReprints={
                            maxReprints
                          }
                        />
                      ) : ticket.ticket_status === "frozen" ? (
                        <TicketReassignAction
                          ticketId={ticket.id}
                          activeRaffles={activeRaffles}
                        />
                      ) : ticket.ticket_status === "reassigned" ? (
                        <p className="text-xs text-muted">
                          Reasignado: se conserva solo como historial.
                        </p>
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
        </>
      )}
    </AdminPage>
  );
}

function TicketStatusBadge({
  status,
}: {
  status: "active" | "frozen" | "reassigned";
}) {
  switch (status) {
    case "active":
      return <Badge tone="approved">Vigente</Badge>;
    case "frozen":
      return <Badge tone="gold">Congelado</Badge>;
    case "reassigned":
      return <Badge>Reasignado</Badge>;
  }
}
