import { notFound } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
import { formatDateTime } from "@/lib/format";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PurchaseRequestPrintPageProps = {
  params: Promise<{ id: string }>;
};

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
}: PurchaseRequestPrintPageProps) {
  const { id: purchaseRequestId } = await params;

  if (!UUID_PATTERN.test(purchaseRequestId)) {
    notFound();
  }

  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: purchaseRequest, error: purchaseRequestError } =
    await adminClient
      .from("purchase_requests")
      .select("id, full_name, dni, status, created_at")
      .eq("id", purchaseRequestId)
      .maybeSingle();

  if (purchaseRequestError) {
    console.error("No se pudo cargar la solicitud:", purchaseRequestError);
    throw new Error("No se pudo cargar la solicitud.");
  }

  if (!purchaseRequest || purchaseRequest.status !== "approved") {
    notFound();
  }

  const { data: tickets, error: ticketsError } = await adminClient
    .from("tickets")
    .select("id, raffle_id, ticket_number")
    .eq("purchase_request_id", purchaseRequestId)
    .eq("ticket_status", "active")
    .order("ticket_number", { ascending: true });

  if (ticketsError) {
    console.error("No se pudieron cargar los tickets:", ticketsError);
    throw new Error("No se pudieron cargar los tickets.");
  }

  const activeTickets = tickets ?? [];

  if (activeTickets.length === 0) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6 text-black print:hidden">
        <p className="mx-auto max-w-xl rounded-lg border border-neutral-300 bg-white p-6 text-sm">
          Esta solicitud no tiene tickets vigentes para imprimir en este
          momento.
        </p>
      </main>
    );
  }

  const { data: raffle, error: raffleError } = await adminClient
    .from("raffles")
    .select("id, name")
    .eq("id", activeTickets[0].raffle_id)
    .maybeSingle();

  if (raffleError || !raffle) {
    console.error("No se pudo cargar la rifa:", raffleError);
    throw new Error("No se pudo cargar la rifa.");
  }

  const ticketIds = activeTickets.map((ticket) => ticket.id);

  const { data: prints, error: printsError } = await adminClient
    .from("ticket_prints")
    .select("ticket_id, print_type, print_sequence, printed_at")
    .in("ticket_id", ticketIds)
    .order("print_sequence", { ascending: false });

  if (printsError) {
    console.error("No se pudieron cargar las impresiones:", printsError);
    throw new Error("No se pudieron cargar las impresiones.");
  }

  /*
   * Ordenado por print_sequence descendente arriba, así que el primer
   * registro que se encuentra por ticket_id ya es el más reciente.
   */
  const latestPrintByTicketId = new Map<
    string,
    { print_type: "original" | "reprint"; print_sequence: number; printed_at: string }
  >();
  for (const print of prints ?? []) {
    if (!latestPrintByTicketId.has(print.ticket_id)) {
      latestPrintByTicketId.set(print.ticket_id, print);
    }
  }

  const formattedPurchasedAt = formatDateTime(purchaseRequest.created_at);
  const lastTicketId = activeTickets[activeTickets.length - 1].id;

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-black print:min-h-0 print:bg-white print:p-0">
      <PrintControls />

      {activeTickets.map((ticket) => {
        const print = latestPrintByTicketId.get(ticket.id);

        const reprintLabel = print
          ? print.print_type === "original"
            ? "Impresión original"
            : `Reimpresión ${print.print_sequence - 1}`
          : null;

        return (
          <PurchaseRequestTicket
            key={ticket.id}
            raffleName={raffle.name}
            fullName={purchaseRequest.full_name}
            dni={purchaseRequest.dni}
            purchasedAt={formattedPurchasedAt}
            ticketNumber={ticket.ticket_number}
            reprintLabel={reprintLabel}
            printedAt={print ? formatDateTime(print.printed_at) : null}
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
