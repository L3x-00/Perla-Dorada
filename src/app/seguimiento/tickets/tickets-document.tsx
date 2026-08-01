"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { BrandLogo } from "@/components/site/brand-logo";
import { DocumentField } from "@/components/site/document-field";
import { formatDateTime } from "@/lib/format";
import {
  normalizeTrackingCode,
  type DocumentType,
} from "@/lib/validation/document";

type TicketStatus = "active" | "frozen" | "reassigned";

type Purchase = {
  requestId: string;
  raffleId: string;
  raffleName: string;
  purchasedAt: string | null;
  ticketStatus: TicketStatus;
  ticketNumbers: number[];
};

type TicketsPayload = {
  fullName: string;
  dni: string;
  purchases: Purchase[];
};

type ApiResponse = TicketsPayload & {
  error?: string;
};

type FlatTicket = {
  raffleName: string;
  purchasedAt: string | null;
  status: TicketStatus;
  ticketNumber: number;
};

type RaffleGroup = {
  raffleId: string;
  raffleName: string;
  tickets: FlatTicket[];
};

/*
 * Clave de traspaso desde la consulta de estado (/seguimiento). Si el
 * usuario ya buscó su solicitud allí, llega con el DNI guardado y no se lo
 * volvemos a pedir: se cargan los tickets directo.
 */
const LOOKUP_KEY = "pd:ticket-lookup";

export function TicketsDocument() {
  const [documentType, setDocumentType] = useState<DocumentType>("dni");
  const [documentNumber, setDocumentNumber] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TicketsPayload | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  const fetchDocument = useCallback(async (
    dt: DocumentType,
    dni: string,
    code: string,
  ) => {
    setSubmitting(true);
    setError(null);
    setPayload(null);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: dt, dni, trackingCode: code }),
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.purchases) {
        throw new Error(body.error ?? "No se pudo obtener los tickets.");
      }

      setPayload(body);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  /* Carga automática si venimos de la consulta de estado. */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(LOOKUP_KEY);
      sessionStorage.removeItem(LOOKUP_KEY);
    } catch {
      return;
    }

    if (!raw) {
      return;
    }

    let parsed: {
      documentType?: unknown;
      documentNumber?: unknown;
      trackingCode?: unknown;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const dni =
      typeof parsed.documentNumber === "string" ? parsed.documentNumber : "";
    const dt: DocumentType = parsed.documentType === "cui" ? "cui" : "dni";
    const code =
      typeof parsed.trackingCode === "string"
        ? normalizeTrackingCode(parsed.trackingCode)
        : "";

    if (!dni || !code) {
      return;
    }

    /*
     * El init va dentro de una función asíncrona a propósito: evita disparar
     * setState de forma síncrona dentro del efecto (cascada de renders) y
     * deja la carga como una tarea diferida.
     */
    async function autoLoad() {
      setDocumentType(dt);
      setDocumentNumber(dni);
      setTrackingCode(code);
      setAutoLoading(true);
      try {
        await fetchDocument(dt, dni, code);
      } finally {
        setAutoLoading(false);
      }
    }

    void autoLoad();
  }, [fetchDocument]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    await fetchDocument(documentType, documentNumber, trackingCode);
  }

  return (
    <div className="px-6 pt-32 pb-24 print:bg-white print:p-0 print:pt-0">
      {payload ? (
        <RaffleGroups payload={payload} onReset={() => setPayload(null)} />
      ) : autoLoading ? (
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm text-muted">Cargando tus tickets…</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          <header className="mb-8 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              Joyería Perla Dorada
            </p>
            <Link
              href="/seguimiento"
              className="text-sm font-medium text-gold underline-offset-4 hover:underline"
            >
              Ver estado
            </Link>
          </header>

          <h1 className="font-display text-3xl font-light text-cream">
            Descargar mis tickets
          </h1>
          <p className="mt-2 text-sm text-muted">
            Disponible solo para solicitudes aprobadas. Ingresa tu documento y
            tu código único de seguimiento para ver todos tus tickets vigentes e historial.
          </p>

          <form
            onSubmit={submit}
            className="mt-6 space-y-5 rounded-2xl border border-line bg-ink-2 p-6"
          >
            <DocumentField
              idPrefix="tickets"
              documentType={documentType}
              onDocumentTypeChange={setDocumentType}
              value={documentNumber}
              onValueChange={setDocumentNumber}
              showHint={false}
            />

            <div>
              <label htmlFor="ticket-tracking-code" className="sr-only">
                Código de seguimiento
              </label>
              <input
                id="ticket-tracking-code"
                value={trackingCode}
                onChange={(event) =>
                  setTrackingCode(
                    normalizeTrackingCode(event.target.value).slice(0, 16),
                  )
                }
                required
                minLength={8}
                maxLength={16}
                autoComplete="off"
                placeholder="Código de seguimiento"
                className="h-11 w-full rounded-lg border border-line bg-ink px-3 font-mono text-sm uppercase text-cream outline-none transition placeholder:font-sans placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-gold px-4 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Buscando..." : "Ver mis tickets"}
            </button>
          </form>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/*
 * Un mismo documento puede tener tickets de varias compras y, cuando en el
 * futuro haya varios sorteos activos a la vez, de varios sorteos distintos.
 * Se agrupan por sorteo (raffleId, no el nombre: el nombre no es único a
 * nivel de base de datos) para que la persona elija cuál ver, en vez de
 * mostrarle todo mezclado en una sola lista larga.
 */
function groupByRaffle(purchases: Purchase[]): RaffleGroup[] {
  const groups = new Map<string, RaffleGroup>();

  for (const purchase of purchases) {
    let group = groups.get(purchase.raffleId);

    if (!group) {
      group = {
        raffleId: purchase.raffleId,
        raffleName: purchase.raffleName,
        tickets: [],
      };
      groups.set(purchase.raffleId, group);
    }

    const purchasedAt = formatDateTime(purchase.purchasedAt);

    for (const ticketNumber of purchase.ticketNumbers) {
      group.tickets.push({
        raffleName: purchase.raffleName,
        purchasedAt,
        status: purchase.ticketStatus,
        ticketNumber,
      });
    }
  }

  return [...groups.values()];
}

function RaffleGroups({
  payload,
  onReset,
}: {
  payload: TicketsPayload;
  onReset: () => void;
}) {
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(
    null,
  );

  const groups = groupByRaffle(payload.purchases);
  const selectedGroup = groups.find(
    (group) => group.raffleId === selectedRaffleId,
  );

  if (selectedGroup) {
    return (
      <RaffleTicketView
        group={selectedGroup}
        fullName={payload.fullName}
        dni={payload.dni}
        showBackLink={groups.length > 1}
        onBack={() => setSelectedRaffleId(null)}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-light text-cream">
          {groups.length === 1 ? "Tu sorteo" : `Tus ${groups.length} sorteos`}
        </h1>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
        >
          Buscar otra
        </button>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const active = group.tickets.filter(
            (ticket) => ticket.status === "active",
          ).length;
          const frozen = group.tickets.filter(
            (ticket) => ticket.status === "frozen",
          ).length;
          const reassigned = group.tickets.filter(
            (ticket) => ticket.status === "reassigned",
          ).length;

          return (
            <button
              key={group.raffleId}
              type="button"
              onClick={() => setSelectedRaffleId(group.raffleId)}
              className="w-full rounded-2xl border border-line bg-ink-2 p-5 text-left transition-colors duration-300 hover:border-gold"
            >
              <p className="font-display text-xl font-light text-cream">
                {group.raffleName}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                {ticketCountLabel(active, frozen, reassigned)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold">
                Ver mis tickets de este sorteo
                <span aria-hidden>→</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ticketCountLabel(
  active: number,
  frozen: number,
  reassigned: number,
): string {
  const parts = [
    `${active} ticket${active === 1 ? "" : "s"} vigente${active === 1 ? "" : "s"}`,
  ];

  if (frozen > 0) {
    parts.push(`${frozen} congelado${frozen === 1 ? "" : "s"}`);
  }

  if (reassigned > 0) {
    parts.push(`${reassigned} reasignado${reassigned === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}

function RaffleTicketView({
  group,
  fullName,
  dni,
  showBackLink,
  onBack,
  onReset,
}: {
  group: RaffleGroup;
  fullName: string;
  dni: string;
  showBackLink: boolean;
  onBack: () => void;
  onReset: () => void;
}) {
  /*
   * Clave del ticket que se debe imprimir solo (botón "Imprimir este
   * ticket" de una tarjeta puntual). null = se imprime todo, sin filtrar
   * (comportamiento del botón "Imprimir / Guardar PDF" de arriba).
   */
  const [printOnlyKey, setPrintOnlyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!printOnlyKey) {
      return;
    }

    function handleAfterPrint() {
      setPrintOnlyKey(null);
    }

    window.addEventListener("afterprint", handleAfterPrint);
    window.print();

    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printOnlyKey]);

  const printableTickets = group.tickets.filter(
    (ticket) => ticket.status === "active",
  );
  const frozenTickets = group.tickets.filter(
    (ticket) => ticket.status === "frozen",
  );
  const reassignedTickets = group.tickets.filter(
    (ticket) => ticket.status === "reassigned",
  );

  /*
   * Al imprimir un solo ticket, los demás se ocultan SOLO en impresión
   * (print:hidden, la pantalla no cambia). Como cada .ticket-print fuerza
   * su propio salto de página, hay que decirle explícitamente a la última
   * tarjeta que realmente se va a imprimir que no deje una página en
   * blanco después — la regla ":last-of-type" de globals.css no sirve aquí
   * porque mira el último elemento del DOM, no el último visible.
   */
  const ticketsToPrint = printOnlyKey
    ? printableTickets.filter(
        (ticket) => ticketKey(ticket) === printOnlyKey,
      )
    : printableTickets;
  const lastPrintableKey =
    ticketsToPrint.length > 0
      ? ticketKey(ticketsToPrint[ticketsToPrint.length - 1])
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 print:hidden">
        {showBackLink ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
          >
            <span aria-hidden>‹</span> Volver a mis sorteos
          </button>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-light text-cream">
              {group.raffleName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {printableTickets.length === 1
                ? "Tu ticket vigente"
                : `Tus ${printableTickets.length} tickets vigentes`}
              . Cada uno se imprime en su propia hoja.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {printableTickets.length > 0 ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
              >
                Imprimir / Guardar PDF
              </button>
            ) : null}
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              Buscar otra
            </button>
          </div>
        </div>
      </div>

      {frozenTickets.length > 0 ? (
        <StatusNotice>
          {frozenTickets.length === 1
            ? "Un ticket está congelado porque su rifa fue cancelada. El equipo puede reasignarlo a una nueva rifa activa."
            : `${frozenTickets.length} tickets están congelados porque su rifa fue cancelada. El equipo puede reasignarlos a una nueva rifa activa.`}
        </StatusNotice>
      ) : null}

      {reassignedTickets.length > 0 ? (
        <StatusNotice>
          {reassignedTickets.length === 1
            ? "Un ticket anterior fue reasignado; se conserva solo como historial y no es válido para imprimir."
            : `${reassignedTickets.length} tickets anteriores fueron reasignados; se conservan solo como historial y no son válidos para imprimir.`}
        </StatusNotice>
      ) : null}

      {printableTickets.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-ink-2 p-4 text-sm text-muted print:hidden">
          No hay tickets vigentes para imprimir en este momento.
        </p>
      ) : null}

      <div className="space-y-6 print:space-y-0">
        {printableTickets.map((ticket) => {
          const key = ticketKey(ticket);

          return (
            <TicketCard
              key={key}
              raffleName={ticket.raffleName}
              fullName={fullName}
              dni={dni}
              purchasedAt={ticket.purchasedAt}
              ticketNumber={ticket.ticketNumber}
              hiddenForPrint={printOnlyKey !== null && printOnlyKey !== key}
              isLastForPrint={key === lastPrintableKey}
              onPrintThis={() => setPrintOnlyKey(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ticketKey(ticket: FlatTicket): string {
  return `${ticket.raffleName}-${ticket.ticketNumber}`;
}

function StatusNotice({ children }: { children: string }) {
  return (
    <p className="mt-6 rounded-xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-100 print:hidden">
      {children}
    </p>
  );
}

function TicketCard({
  raffleName,
  fullName,
  dni,
  purchasedAt,
  ticketNumber,
  hiddenForPrint,
  isLastForPrint,
  onPrintThis,
}: {
  raffleName: string;
  fullName: string;
  dni: string;
  purchasedAt: string | null;
  ticketNumber: number;
  hiddenForPrint: boolean;
  isLastForPrint: boolean;
  onPrintThis: () => void;
}) {
  /*
   * Formato de recibo térmico de 80mm (impresora portátil tipo HOIN HQ300,
   * 203 DPI): angosto y vertical. En pantalla se ve como una tira angosta
   * (vista previa honesta de lo que realmente va a salir); al imprimir,
   * .ticket-print fija 72mm de ancho dentro de la página de 80mm (ver
   * @page "ticket" en globals.css) y aquí se agregan los 2mm de margen
   * interior a cada lado.
   */
  return (
    <div
      className={`ticket-print mx-auto w-72 print:mx-auto print:w-[72mm] print:max-w-[576px] ${
        hiddenForPrint ? "print:hidden" : ""
      }`}
      style={isLastForPrint ? { breakAfter: "auto" } : undefined}
    >
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

        <p className="mt-2 text-center text-sm font-bold leading-snug">
          {raffleName}
        </p>

        <div className="my-3 border-t border-dashed border-neutral-500" />

        {/* Número: lo más grande y visible del recibo */}
        <div className="text-center">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em]">
            Número asignado
          </p>
          <p className="mt-1 text-6xl font-black leading-none tabular-nums">
            {String(ticketNumber).padStart(4, "0")}
          </p>
        </div>

        <div className="my-3 border-t border-dashed border-neutral-500" />

        <dl className="space-y-2 text-xs">
          <Field label="Nombre" value={fullName} />
          <Field label="DNI" value={dni} />
          {purchasedAt ? <Field label="Fecha de compra" value={purchasedAt} /> : null}
        </dl>

        {/* Avance final: que el corte/rasgado no pise el texto. */}
        <div className="hidden print:block" style={{ height: "16mm" }} />
      </article>

      <button
        type="button"
        onClick={onPrintThis}
        className="mt-2 w-full rounded-lg border border-line py-2 text-xs font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold print:hidden"
      >
        Imprimir este ticket
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold leading-snug break-words">{value}</dd>
    </div>
  );
}
