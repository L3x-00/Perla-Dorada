import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
import { BrandLogo } from "@/components/site/brand-logo";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  if (!ticket) {
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

  const formattedTicketNumber = String(
    ticket.ticket_number,
  ).padStart(4, "0");

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
      <PrintControls />

      {/* Mismo ticket que recibe el cliente: logo, sorteo, número y datos. */}
      <div className="ticket-print mx-auto max-w-[20rem] print:max-w-none">
        <article className="relative overflow-hidden rounded-2xl border border-neutral-300 bg-white text-black shadow-lg print:rounded-lg print:shadow-none">
          <div
            className="h-1.5 w-full bg-gold"
            style={{
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          />

          <div className="px-6 pt-5 text-center">
            <BrandLogo className="mx-auto h-auto w-24" />
            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Ticket de sorteo
            </p>
            <h1 className="mt-1 font-display text-lg font-medium leading-snug">
              {raffle.name}
            </h1>
          </div>

          <div className="my-4 flex items-center gap-2 px-6">
            <span className="text-gold" style={{ printColorAdjust: "exact" }}>
              ◆
            </span>
            <div className="flex-1 border-t border-dashed border-neutral-300" />
            <span className="text-gold" style={{ printColorAdjust: "exact" }}>
              ◆
            </span>
          </div>

          <div className="px-6 text-center">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Número asignado
            </p>
            <p className="mt-1 font-display text-6xl font-black leading-none tabular-nums">
              {formattedTicketNumber}
            </p>
          </div>

          <dl className="mt-6 space-y-2.5 px-6 text-sm">
            <TicketRow label="Nombre" value={purchaseRequest.full_name} />
            <TicketRow label="DNI" value={purchaseRequest.dni} />
            {formattedPurchasedAt ? (
              <TicketRow label="Fecha de compra" value={formattedPurchasedAt} />
            ) : null}
          </dl>

          {/* Pie de control de impresión (uso interno del panel). */}
          <footer className="mt-5 border-t border-dashed border-neutral-300 px-6 py-3 text-center text-[10px] text-neutral-500">
            {reprintLabel}
            {formattedPrintedAt ? ` · ${formattedPrintedAt}` : ""}
          </footer>
        </article>
      </div>
    </main>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-2 last:border-0">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}