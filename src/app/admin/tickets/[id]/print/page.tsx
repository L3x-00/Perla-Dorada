import { notFound } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
import { PrintProfileScope } from "@/components/printing/print-profile";
import { TicketReceipt } from "@/components/printing/ticket-receipt";
import { formatDateTime } from "@/lib/format";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TicketPrintPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    printId?: string | string[];
  }>;
};

export default async function TicketPrintPage({
  params,
  searchParams,
}: TicketPrintPageProps) {
  const { id: ticketId } = await params;

  const resolvedSearchParams =
    await searchParams;

  const printId =
    typeof resolvedSearchParams.printId ===
    "string"
      ? resolvedSearchParams.printId
      : undefined;

  if (
    !UUID_PATTERN.test(ticketId) ||
    !printId ||
    !UUID_PATTERN.test(printId)
  ) {
    notFound();
  }

  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: printRecord, error: printError } =
    await adminClient
      .from("ticket_prints")
      .select(
        `
          id,
          ticket_id,
          print_sequence,
          print_type,
          printed_at,
          reason
        `,
      )
      .eq("id", printId)
      .eq("ticket_id", ticketId)
      .maybeSingle();

  if (printError) {
    console.error(
      "Could not load print record",
      printError,
    );

    throw new Error(
      "No se pudo cargar el registro de impresión.",
    );
  }

  if (!printRecord) {
    notFound();
  }

  const { data: ticket, error: ticketError } =
    await adminClient
      .from("tickets")
      .select(
        `
          id,
          raffle_id,
          purchase_request_id,
          ticket_number,
          ticket_status,
          assigned_at
        `,
      )
      .eq("id", ticketId)
      .maybeSingle();

  if (ticketError) {
    console.error(
      "Could not load ticket",
      ticketError,
    );

    throw new Error(
      "No se pudo cargar el ticket.",
    );
  }

  if (!ticket || ticket.ticket_status !== "active") {
    notFound();
  }

  const [
    raffleResult,
    purchaseRequestResult,
  ] = await Promise.all([
    adminClient
      .from("raffles")
      .select("id, name")
      .eq("id", ticket.raffle_id)
      .maybeSingle(),

    adminClient
      .from("purchase_requests")
      .select(
        `
          id,
          full_name,
          document_type,
          dni,
          status,
          created_at
        `,
      )
      .eq(
        "id",
        ticket.purchase_request_id,
      )
      .maybeSingle(),
  ]);

  if (
    raffleResult.error ||
    purchaseRequestResult.error
  ) {
    console.error(
      "Could not load printable ticket dependencies",
      {
        raffleError:
          raffleResult.error,
        purchaseRequestError:
          purchaseRequestResult.error,
      },
    );

    throw new Error(
      "No se pudo cargar la información del ticket.",
    );
  }

  const raffle = raffleResult.data;
  const purchaseRequest =
    purchaseRequestResult.data;

  if (
    !raffle ||
    !purchaseRequest ||
    purchaseRequest.status !== "approved"
  ) {
    notFound();
  }

  const formattedPurchasedAt = formatDateTime(
    purchaseRequest.created_at,
  );

  const formattedPrintedAt = formatDateTime(
    printRecord.printed_at,
  );

  const reprintLabel =
    printRecord.print_type === "original"
      ? "Impresión original"
      : `Reimpresión ${printRecord.print_sequence - 1}`;

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-black print:min-h-0 print:bg-white print:p-0">
      <PrintProfileScope>
        <PrintControls />
        <TicketReceipt
          raffleId={ticket.raffle_id}
          raffleName={raffle.name}
          fullName={purchaseRequest.full_name}
          documentLabel={
            purchaseRequest.document_type === "cui" ? "CUI" : "DNI"
          }
          documentNumber={purchaseRequest.dni}
          purchasedAt={formattedPurchasedAt}
          ticketNumber={ticket.ticket_number}
          auditLabel={reprintLabel}
          printedAt={formattedPrintedAt}
          isLastForPrint
        />
      </PrintProfileScope>
    </main>
  );
}
