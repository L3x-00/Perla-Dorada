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

      {/*
        Formato de recibo térmico de 80mm (impresora portátil, 203 DPI):
        mismo diseño que recibe el cliente en /seguimiento/tickets. En
        pantalla es una tira angosta (vista previa honesta); al imprimir,
        .ticket-print fija 72mm dentro de la página de 80mm (@page "ticket"
        en globals.css) y aquí se agrega el margen interior de 2mm.
      */}
      <div className="ticket-print mx-auto w-72 print:mx-auto print:w-[72mm] print:max-w-[576px]">
        <article className="rounded-lg border border-neutral-300 bg-white p-4 font-mono text-black shadow-sm print:rounded-none print:border-0 print:px-[2mm] print:py-0 print:shadow-none">
          {/*
            El logo no se imprime: en un recibo térmico no aporta (consume
            papel y tiempo de impresión rasterizando una imagen). Sigue
            visible en la vista previa de pantalla.
          */}
          <div className="flex flex-col items-center text-center print:hidden">
            <BrandLogo className="h-auto w-12" />
          </div>

          <p className="text-center text-[0.62rem] font-bold uppercase tracking-[0.18em]">
            Ticket de sorteo
          </p>

          <h1 className="mt-2 text-center text-sm font-bold leading-snug">
            {raffle.name}
          </h1>

          <div className="my-3 border-t border-dashed border-neutral-500" />

          <div className="text-center">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em]">
              Número asignado
            </p>
            <p className="mt-1 text-6xl font-black leading-none tabular-nums">
              {formattedTicketNumber}
            </p>
          </div>

          <div className="my-3 border-t border-dashed border-neutral-500" />

          <dl className="space-y-2 text-xs">
            <TicketRow label="Nombre" value={purchaseRequest.full_name} />
            <TicketRow label="DNI" value={purchaseRequest.dni} />
            {formattedPurchasedAt ? (
              <TicketRow
                label="Fecha de compra"
                value={formattedPurchasedAt}
              />
            ) : null}
          </dl>

          {/* Control de impresión (uso interno del panel). */}
          <p className="mt-3 border-t border-dashed border-neutral-500 pt-2 text-[0.6rem] text-neutral-500">
            {reprintLabel}
            {formattedPrintedAt ? ` · ${formattedPrintedAt}` : ""}
          </p>

          {/* Avance final: que el corte/rasgado no pise el texto. */}
          <div className="hidden print:block" style={{ height: "16mm" }} />
        </article>
      </div>
    </main>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold leading-snug break-words">{value}</dd>
    </div>
  );
}
