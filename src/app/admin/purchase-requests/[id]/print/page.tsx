import { notFound } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
import { AdminUrnTicket } from "@/components/admin/printing/admin-urn-ticket";
import { PrintProfileScope } from "@/components/printing/print-profile";
import { formatCompactLimaDateTime } from "@/lib/format";
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
 * Usa un talón mínimo exclusivo del panel. El comprobante público conserva
 * por separado toda la información de la rifa y del participante.
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
        "id, full_name, phone, status, created_at, requested_quantity",
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
    .select("id, ticket_id")
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

  const raffleIds = new Set(activeTickets.map((ticket) => ticket.raffle_id));

  if (raffleIds.size !== 1) {
    notFound();
  }

  const printedTicketIds = new Set<string>();
  for (const print of batchPrints) {
    printedTicketIds.add(print.ticket_id);
  }

  const formattedPurchasedAt = formatCompactLimaDateTime(
    purchaseRequest.created_at,
  );

  if (!formattedPurchasedAt) {
    throw new Error("La fecha de compra no es válida.");
  }

  const lastTicketId = activeTickets[activeTickets.length - 1].id;

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-black print:min-h-0 print:bg-white print:p-0">
      <PrintProfileScope>
        <PrintControls />

        {activeTickets.map((ticket) => {
          if (!printedTicketIds.has(ticket.id)) {
            return null;
          }

          return (
            <AdminUrnTicket
              key={ticket.id}
              ticketNumber={ticket.ticket_number}
              purchasedAt={formattedPurchasedAt}
              fullName={purchaseRequest.full_name}
              phone={purchaseRequest.phone}
              isLastForPrint={ticket.id === lastTicketId}
            />
          );
        })}
      </PrintProfileScope>
    </main>
  );
}
