import { notFound } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
import { PrintProfileScope } from "@/components/printing/print-profile";
import { TicketReceipt } from "@/components/printing/ticket-receipt";
import { formatDateTime } from "@/lib/format";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PurchaseRequestPrintPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ batchId?: string | string[] }>;
};

const MAX_BATCH_TICKETS = 100;

function parseBatchId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

/*
 * Documento único con TODOS los tickets activos de una solicitud aprobada,
 * listo para imprimir de corrido en la impresora térmica (para las ánforas
 * del sorteo). Reemplaza el flujo anterior de un botón/ventana por ticket.
 * Comparte el mismo recibo adaptable que /admin/tickets/[id]/print y el
 * documento público de /seguimiento/tickets.
 */
export default async function PurchaseRequestPrintPage({
  params,
  searchParams,
}: PurchaseRequestPrintPageProps) {
  const { id: purchaseRequestId } = await params;
  const resolvedSearchParams = await searchParams;
  const batchId = parseBatchId(resolvedSearchParams.batchId);

  if (!UUID_PATTERN.test(purchaseRequestId) || !batchId) {
    notFound();
  }

  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: purchaseRequest, error: purchaseRequestError } =
    await adminClient
      .from("purchase_requests")
      .select(
        "id, full_name, document_type, dni, status, created_at, requested_quantity",
      )
      .eq("id", purchaseRequestId)
      .maybeSingle();

  if (purchaseRequestError) {
    console.error("No se pudo cargar la solicitud:", purchaseRequestError);
    throw new Error("No se pudo cargar la solicitud.");
  }

  if (!purchaseRequest || purchaseRequest.status !== "approved") {
    notFound();
  }

  const { data: prints, error: printsError } = await adminClient
    .from("ticket_prints")
    .select("id, ticket_id, print_type, print_sequence, printed_at")
    .eq("print_batch_id", batchId)
    .order("printed_at", { ascending: true });

  if (printsError) {
    console.error("No se pudieron cargar las impresiones:", printsError);
    throw new Error("No se pudieron cargar las impresiones.");
  }

  const batchPrints = prints ?? [];
  const ticketIds = batchPrints.map((print) => print.ticket_id);

  if (
    batchPrints.length === 0 ||
    batchPrints.length > MAX_BATCH_TICKETS ||
    batchPrints.length !== purchaseRequest.requested_quantity ||
    new Set(ticketIds).size !== batchPrints.length
  ) {
    notFound();
  }

  const { data: tickets, error: ticketsError } = await adminClient
    .from("tickets")
    .select("id, raffle_id, purchase_request_id, ticket_number, ticket_status")
    .in("id", ticketIds)
    .order("ticket_number", { ascending: true });

  if (ticketsError) {
    console.error("No se pudieron cargar los tickets:", ticketsError);
    throw new Error("No se pudieron cargar los tickets.");
  }

  const activeTickets = tickets ?? [];

  if (
    activeTickets.length !== batchPrints.length ||
    activeTickets.some(
      (ticket) =>
        ticket.purchase_request_id !== purchaseRequestId ||
        ticket.ticket_status !== "active",
    )
  ) {
    notFound();
  }

  const raffleIds = [...new Set(activeTickets.map((ticket) => ticket.raffle_id))];
  const { data: raffles, error: rafflesError } = await adminClient
    .from("raffles")
    .select("id, name")
    .in("id", raffleIds);

  if (rafflesError) {
    console.error("No se pudieron cargar las rifas:", rafflesError);
    throw new Error("No se pudieron cargar las rifas.");
  }

  if ((raffles?.length ?? 0) !== raffleIds.length) {
    notFound();
  }

  const raffleNameById = new Map(
    (raffles ?? []).map((raffle) => [raffle.id, raffle.name]),
  );

  const printByTicketId = new Map<
    string,
    { print_type: "original" | "reprint"; print_sequence: number; printed_at: string }
  >();
  for (const print of batchPrints) {
    printByTicketId.set(print.ticket_id, print);
  }

  const formattedPurchasedAt = formatDateTime(purchaseRequest.created_at);
  const lastTicketId = activeTickets[activeTickets.length - 1].id;

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-black print:min-h-0 print:bg-white print:p-0">
      <PrintProfileScope>
        <PrintControls />

        {activeTickets.map((ticket) => {
          const print = printByTicketId.get(ticket.id);
          const raffleName = raffleNameById.get(ticket.raffle_id);

          if (!print || !raffleName) {
            return null;
          }

          const reprintLabel =
            print.print_type === "original"
              ? "Impresión original"
              : `Reimpresión ${print.print_sequence - 1}`;

          return (
            <TicketReceipt
              key={ticket.id}
              raffleId={ticket.raffle_id}
              raffleName={raffleName}
              fullName={purchaseRequest.full_name}
              documentLabel={
                purchaseRequest.document_type === "cui" ? "CUI" : "DNI"
              }
              documentNumber={purchaseRequest.dni}
              purchasedAt={formattedPurchasedAt}
              ticketNumber={ticket.ticket_number}
              auditLabel={reprintLabel}
              printedAt={formatDateTime(print.printed_at)}
              isLastForPrint={ticket.id === lastTicketId}
            />
          );
        })}
      </PrintProfileScope>
    </main>
  );
}
