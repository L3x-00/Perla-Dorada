"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { DocumentField } from "@/components/site/document-field";
import { siteInputClass } from "@/components/site/form-controls";
import {
  PrintProfileScope,
  PrintProfileSelector,
} from "@/components/printing/print-profile";
import { TicketReceipt } from "@/components/printing/ticket-receipt";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import { formatTicketCode } from "@/lib/tickets/code";
import {
  normalizeTrackingCode,
  type DocumentType,
  validateDocumentNumber,
} from "@/lib/validation/document";

type TicketStatus = "active" | "frozen" | "reassigned";
type RaffleStatus = "draft" | "active" | "closed" | "cancelled";

type TicketEntry = {
  requestId: string;
  raffleId: string;
  raffleName: string;
  raffleStatus: RaffleStatus;
  purchasedAt: string | null;
  ticketStatus: TicketStatus;
  ticketNumber: number;
  amountPaid: number;
  isWinner: boolean;
  prizeTitle: string | null;
};

type TicketsPayload = {
  fullName: string;
  documentType: DocumentType;
  dni: string;
  tickets: TicketEntry[];
};

type ApiResponse = TicketsPayload & {
  error?: string;
};

type FlatTicket = {
  requestId: string;
  raffleName: string;
  purchasedAt: string | null;
  status: TicketStatus;
  ticketNumber: number;
  amountPaid: number;
  isWinner: boolean;
  prizeTitle: string | null;
};

type RaffleGroup = {
  raffleId: string;
  raffleName: string;
  raffleStatus: RaffleStatus;
  tickets: FlatTicket[];
};

const RAFFLE_STATUS_LABEL: Partial<Record<RaffleStatus, string>> = {
  closed: "Sorteo cerrado",
  cancelled: "Sorteo cancelado",
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
  const trackingCodeRef = useRef<HTMLInputElement | null>(null);

  const documentComplete =
    documentNumber.length > 0 &&
    !validateDocumentNumber(documentType, documentNumber);

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

      if (!response.ok || !body.tickets) {
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
              onInputBlur={() => {
                if (documentComplete) {
                  window.requestAnimationFrame(() => trackingCodeRef.current?.focus());
                }
              }}
            />

            <div>
              <label htmlFor="ticket-tracking-code" className="sr-only">
                Código de seguimiento
              </label>
              <input
                id="ticket-tracking-code"
                ref={trackingCodeRef}
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
                className={`${siteInputClass} h-11 px-3 font-mono text-sm uppercase placeholder:font-sans focus:ring-2 focus:ring-gold/20`}
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
 * mostrarle todo mezclado en una sola lista larga. Un sorteo ya cerrado o
 * cancelado se sigue mostrando igual (con sus tickets), solo que con un
 * aviso: el ticket sigue siendo válido como comprobante de participación.
 */
function groupByRaffle(tickets: TicketEntry[]): RaffleGroup[] {
  const groups = new Map<string, RaffleGroup>();

  for (const ticket of tickets) {
    let group = groups.get(ticket.raffleId);

    if (!group) {
      group = {
        raffleId: ticket.raffleId,
        raffleName: ticket.raffleName,
        raffleStatus: ticket.raffleStatus,
        tickets: [],
      };
      groups.set(ticket.raffleId, group);
    }

    group.tickets.push({
      requestId: ticket.requestId,
      raffleName: ticket.raffleName,
      purchasedAt: formatDateTime(ticket.purchasedAt),
      status: ticket.ticketStatus,
      ticketNumber: ticket.ticketNumber,
      amountPaid: ticket.amountPaid,
      isWinner: ticket.isWinner,
      prizeTitle: ticket.prizeTitle,
    });
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

  const groups = groupByRaffle(payload.tickets);
  const selectedGroup = groups.find(
    (group) => group.raffleId === selectedRaffleId,
  );

  if (selectedGroup) {
    return (
      <RaffleTicketView
        group={selectedGroup}
        fullName={payload.fullName}
        documentType={payload.documentType}
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
          const winnerCount = group.tickets.filter(
            (ticket) => ticket.isWinner,
          ).length;
          const statusLabel = RAFFLE_STATUS_LABEL[group.raffleStatus];

          return (
            <button
              key={group.raffleId}
              type="button"
              onClick={() => setSelectedRaffleId(group.raffleId)}
              className="w-full rounded-2xl border border-line bg-ink-2 p-5 text-left transition-colors duration-300 hover:border-gold"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="font-display text-xl font-light text-cream">
                  {group.raffleName}
                </p>
                {winnerCount > 0 ? (
                  <span className="rounded-full border border-gold-deep/70 bg-gold-deep/15 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gold-soft">
                    🏆 {winnerCount === 1 ? "Ticket ganador" : `${winnerCount} tickets ganadores`}
                  </span>
                ) : null}
                {statusLabel ? (
                  <span className="rounded-full border border-amber-700/70 bg-amber-950/40 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber-200">
                    {statusLabel}
                  </span>
                ) : null}
              </div>
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
  documentType,
  dni,
  showBackLink,
  onBack,
  onReset,
}: {
  group: RaffleGroup;
  fullName: string;
  documentType: DocumentType;
  dni: string;
  showBackLink: boolean;
  onBack: () => void;
  onReset: () => void;
}) {
  /*
   * Clave del ticket que se debe imprimir solo (se toca un cuadrado
   * puntual). null = se imprime todo, sin filtrar (botón "Imprimir /
   * Guardar PDF" de arriba).
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
  const statusLabel = RAFFLE_STATUS_LABEL[group.raffleStatus];

  /*
   * Al imprimir un solo ticket, los demás no se imprimen (print:hidden, la
   * pantalla no cambia). Como cada .ticket-print fuerza su propio salto de
   * página, hay que decirle explícitamente al último que realmente se va a
   * imprimir que no deje una página en blanco después.
   */
  const ticketsToPrint = printOnlyKey
    ? printableTickets.filter((ticket) => ticketKey(ticket) === printOnlyKey)
    : printableTickets;
  const lastPrintableKey =
    ticketsToPrint.length > 0
      ? ticketKey(ticketsToPrint[ticketsToPrint.length - 1])
      : null;

  return (
    <PrintProfileScope className="mx-auto max-w-2xl">
      <div className="mb-8 print:hidden">
        <PrintProfileSelector className="mb-5" />

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
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-light text-cream">
                {group.raffleName}
              </h1>
              {statusLabel ? (
                <span className="rounded-full border border-amber-700/70 bg-amber-950/40 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber-200">
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {printableTickets.length === 1
                ? "Tu ticket vigente"
                : `Tus ${printableTickets.length} tickets vigentes`}
              . Toca uno para imprimirlo, o usa &quot;Imprimir todos&quot;.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {printableTickets.length > 0 ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
              >
                Imprimir todos / Guardar PDF
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

      {statusLabel ? (
        <StatusNotice>
          Este sorteo ya {group.raffleStatus === "cancelled" ? "fue cancelado" : "cerró"}. Tus tickets siguen siendo válidos como comprobante de participación.
        </StatusNotice>
      ) : null}

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

      {/*
        Vista de pantalla: cuadrados compactos, no la tarjeta completa —
        con 17 tickets, una pila de tarjetas grandes es incómoda de
        recorrer. Cada cuadrado imprime SOLO ese ticket al tocarlo.
      */}
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        {printableTickets.map((ticket) => (
          <TicketChip
            key={ticketKey(ticket)}
            raffleName={ticket.raffleName}
            ticketNumber={ticket.ticketNumber}
            amountPaid={ticket.amountPaid}
            isWinner={ticket.isWinner}
            prizeTitle={ticket.prizeTitle}
            onPrintThis={() => setPrintOnlyKey(ticketKey(ticket))}
          />
        ))}
      </div>

      {/* Recibo completo: solo existe para la impresión, nunca se ve en pantalla. */}
      <div className="hidden print:block">
        {printableTickets.map((ticket) => {
          const key = ticketKey(ticket);

          return (
            <TicketReceipt
              key={key}
              raffleName={ticket.raffleName}
              fullName={fullName}
              documentLabel={documentType === "cui" ? "CUI" : "DNI"}
              documentNumber={dni}
              purchasedAt={ticket.purchasedAt}
              ticketNumber={ticket.ticketNumber}
              printOnly
              hiddenForPrint={printOnlyKey !== null && printOnlyKey !== key}
              isLastForPrint={key === lastPrintableKey}
            />
          );
        })}
      </div>
    </PrintProfileScope>
  );
}

function ticketKey(ticket: FlatTicket): string {
  return `${ticket.requestId}-${ticket.ticketNumber}`;
}

function StatusNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-100 print:hidden">
      {children}
    </p>
  );
}

/*
 * Cuadro compacto: es lo que se ve en pantalla al navegar la lista de
 * tickets de un sorteo. Muestra lo esencial (sorteo, número, monto pagado)
 * sin llegar a ser la tarjeta completa. El botón de imprimir vive dentro del
 * mismo recuadro e imprime SOLO ese ticket (el recibo completo real vive
 * oculto, ver TicketReceipt).
 */
function TicketChip({
  raffleName,
  ticketNumber,
  amountPaid,
  isWinner,
  prizeTitle,
  onPrintThis,
}: {
  raffleName: string;
  ticketNumber: number;
  amountPaid: number;
  isWinner: boolean;
  prizeTitle: string | null;
  onPrintThis: () => void;
}) {
  const winnerClasses =
    "border-gold bg-gradient-to-b from-gold-deep/40 to-ink-2 text-gold-soft shadow-[0_0_18px_-4px_rgba(201,162,39,0.55)]";
  const defaultClasses = "border-emerald-700 bg-emerald-950 text-emerald-200";

  return (
    <div
      className={`flex w-36 flex-col items-center gap-1 rounded-xl border p-3 text-center ${
        isWinner ? winnerClasses : defaultClasses
      }`}
    >
      {isWinner ? (
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-gold">
          🏆 Ganador
        </p>
      ) : null}

      <p
        className={`line-clamp-2 text-[0.65rem] font-medium uppercase leading-tight tracking-wide ${
          isWinner ? "text-gold-soft/80" : "text-emerald-300"
        }`}
      >
        {raffleName}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">
        {formatTicketCode(ticketNumber)}
      </p>

      {isWinner && prizeTitle ? (
        <p className="line-clamp-2 text-[0.65rem] font-medium leading-tight text-gold-soft">
          {prizeTitle}
        </p>
      ) : null}

      <p className={`text-xs ${isWinner ? "text-gold-soft/80" : "text-emerald-300"}`}>
        {formatCurrencyPEN(amountPaid)}
      </p>

      <button
        type="button"
        onClick={onPrintThis}
        className={`mt-1.5 w-full rounded-full border px-2 py-1 text-[0.65rem] font-medium transition-colors duration-200 hover:border-gold hover:bg-ink-2 hover:text-gold ${
          isWinner
            ? "border-gold-deep text-gold-soft"
            : "border-emerald-600 text-emerald-100"
        }`}
      >
        Imprimir
      </button>
    </div>
  );
}
