import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/app/admin/tickets/[id]/print/print-controls";
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
      .select(
        `
          id,
          name,
          description,
          ticket_price,
          draw_at
        `,
      )
      .eq("id", ticket.raffle_id)
      .maybeSingle(),

    adminClient
      .from("purchase_requests")
      .select(
        `
          id,
          full_name,
          dni,
          phone,
          whatsapp,
          status,
          tracking_code
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

  const formattedPrice =
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(
      Number(raffle.ticket_price),
    );

  const formattedAssignedAt =
    new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(
      new Date(ticket.assigned_at),
    );

  const formattedPrintedAt =
    new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(
      new Date(printRecord.printed_at),
    );

  const formattedDrawAt =
    raffle.draw_at
      ? new Intl.DateTimeFormat(
          "es-PE",
          {
            dateStyle: "long",
            timeStyle: "short",
          },
        ).format(
          new Date(raffle.draw_at),
        )
      : null;

  return (
    <main className="min-h-screen bg-neutral-100 p-6 text-black print:bg-white print:p-0">
      <PrintControls />

      <article className="mx-auto max-w-xl border-2 border-black bg-white p-8 shadow-lg print:max-w-none print:shadow-none">
        <header className="border-b-2 border-black pb-5 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em]">
            Joyería Perla Dorada
          </p>

          <h1 className="mt-3 text-3xl font-black uppercase">
            {raffle.name}
          </h1>

          {raffle.description ? (
            <p className="mt-3 text-sm">
              {raffle.description}
            </p>
          ) : null}
        </header>

        <section className="py-8 text-center">
          <p className="text-sm font-bold uppercase tracking-wide">
            Número de ticket
          </p>

          <p className="mt-3 text-7xl font-black tabular-nums">
            {formattedTicketNumber}
          </p>
        </section>

        <section className="grid gap-3 border-y-2 border-black py-5 text-sm">
          <p>
            <strong>Participante:</strong>{" "}
            {purchaseRequest.full_name}
          </p>

          <p>
            <strong>DNI:</strong>{" "}
            {purchaseRequest.dni}
          </p>

          <p>
            <strong>Teléfono:</strong>{" "}
            {purchaseRequest.phone}
          </p>

          <p>
            <strong>WhatsApp:</strong>{" "}
            {purchaseRequest.whatsapp}
          </p>

          <p>
            <strong>
              Código de seguimiento:
            </strong>{" "}
            {purchaseRequest.tracking_code}
          </p>

          <p>
            <strong>Precio:</strong>{" "}
            {formattedPrice}
          </p>

          <p>
            <strong>
              Fecha de asignación:
            </strong>{" "}
            {formattedAssignedAt}
          </p>

          {formattedDrawAt ? (
            <p>
              <strong>
                Fecha del sorteo:
              </strong>{" "}
              {formattedDrawAt}
            </p>
          ) : null}
        </section>

        <footer className="space-y-1 pt-5 text-xs">
          <p>
            <strong>Tipo:</strong>{" "}
            {printRecord.print_type ===
            "original"
              ? "Impresión original"
              : `Reimpresión ${
                  printRecord.print_sequence -
                  1
                }`}
          </p>

          <p>
            <strong>
              Secuencia registrada:
            </strong>{" "}
            {printRecord.print_sequence}
          </p>

          <p>
            <strong>
              Fecha de impresión:
            </strong>{" "}
            {formattedPrintedAt}
          </p>

          {printRecord.reason ? (
            <p>
              <strong>Motivo:</strong>{" "}
              {printRecord.reason}
            </p>
          ) : null}

          <p className="pt-3 text-center text-[10px] text-neutral-600">
            Registro de impresión:{" "}
            {printRecord.id}
          </p>
        </footer>
      </article>
    </main>
  );
}