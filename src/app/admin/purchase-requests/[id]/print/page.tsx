import { notFound } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
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
 * Mismo formato de recibo de 80mm que /admin/tickets/[id]/print y el
 * documento público de /seguimiento/tickets — ver comentarios ahí para el
 * detalle del formato físico.
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
      .select("id, full_name, dni, status, created_at, requested_quantity")
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
          <PurchaseRequestTicket
            key={ticket.id}
            raffleName={raffleName}
            fullName={purchaseRequest.full_name}
            dni={purchaseRequest.dni}
            purchasedAt={formattedPurchasedAt}
            ticketNumber={ticket.ticket_number}
            reprintLabel={reprintLabel}
            printedAt={formatDateTime(print.printed_at)}
            isLastForPrint={ticket.id === lastTicketId}
          />
        );
      })}
    </main>
  );
}

function PurchaseRequestTicket({
  raffleName,
  fullName,
  dni,
  purchasedAt,
  ticketNumber,
  reprintLabel,
  printedAt,
  isLastForPrint,
}: {
  raffleName: string;
  fullName: string;
  dni: string;
  purchasedAt: string | null;
  ticketNumber: number;
  reprintLabel: string | null;
  printedAt: string | null;
  isLastForPrint: boolean;
}) {
  /*
   * Mismo formato de recibo térmico de 80mm que el resto del sistema (ver
   * /admin/tickets/[id]/print y /seguimiento/tickets). Cada ticket fuerza su
   * propio salto de página (.ticket-print, @page "ticket" en globals.css);
   * el último de la tanda evita dejar una página en blanco después.
   */
  return (
    <div
      className="ticket-print mx-auto w-72 print:mx-auto print:w-[72mm] print:max-w-[576px]"
      style={isLastForPrint ? { breakAfter: "auto" } : undefined}
    >
      <article className="mb-4 rounded-lg border border-neutral-300 bg-white p-4 font-mono text-black shadow-sm print:mb-0 print:rounded-none print:border-0 print:px-[2mm] print:py-0 print:shadow-none">
        <p className="text-center text-[0.62rem] font-bold uppercase tracking-[0.18em]">
          Ticket de sorteo
        </p>

        <h1 className="mt-2 text-center text-base font-bold leading-snug">
          {raffleName}
        </h1>

        <div className="my-3 border-t border-dashed border-neutral-500" />

        <div className="text-center">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em]">
            Número asignado
          </p>
          <p className="mt-1 text-5xl font-black leading-none tabular-nums">
            {String(ticketNumber).padStart(4, "0")}
          </p>
        </div>

        <div className="my-3 border-t border-dashed border-neutral-500" />

        <dl className="space-y-2 text-sm">
          <TicketRow label="Nombre" value={fullName} />
          <TicketRow label="DNI" value={dni} />
          {purchasedAt ? (
            <TicketRow label="Fecha de compra" value={purchasedAt} />
          ) : null}
        </dl>

        {reprintLabel ? (
          <p className="mt-3 border-t border-dashed border-neutral-500 pt-2 text-[0.6rem] text-neutral-500">
            {reprintLabel}
            {printedAt ? ` · ${printedAt}` : ""}
          </p>
        ) : null}

        <div className="hidden print:block" style={{ height: "16mm" }} />
      </article>
    </div>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold leading-snug break-words">{value}</dd>
    </div>
  );
}
