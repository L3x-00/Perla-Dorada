import { brand } from "@/config/brand";

type TicketReceiptProps = {
  raffleId: string;
  raffleName: string;
  fullName: string;
  documentLabel: string;
  documentNumber: string;
  purchasedAt: string | null;
  ticketNumber: number;
  auditLabel?: string | null;
  printedAt?: string | null;
  printOnly?: boolean;
  hiddenForPrint?: boolean;
  isLastForPrint?: boolean;
};

export function buildTicketReference(
  raffleId: string,
  ticketNumber: number,
): string {
  const compactRaffleId = raffleId.replaceAll("-", "").toUpperCase();
  const formattedTicketNumber = String(ticketNumber).padStart(4, "0");

  return `PD-${compactRaffleId}-${formattedTicketNumber}`;
}

export function TicketReceipt({
  raffleId,
  raffleName,
  fullName,
  documentLabel,
  documentNumber,
  purchasedAt,
  ticketNumber,
  auditLabel,
  printedAt,
  printOnly = false,
  hiddenForPrint = false,
  isLastForPrint = false,
}: TicketReceiptProps) {
  const visibilityClass = hiddenForPrint
    ? "hidden"
    : printOnly
      ? "hidden print:block"
      : "";
  const ticketReference = buildTicketReference(raffleId, ticketNumber);
  const referenceBreakIndex = 19;

  return (
    <div
      className={`ticket-print ${visibilityClass}`}
      style={isLastForPrint ? { breakAfter: "auto" } : undefined}
    >
      <article className="ticket-receipt">
        <header className="ticket-receipt__header">
          <p className="ticket-receipt__business">{brand.name}</p>
          <p className="ticket-receipt__kind">Ticket oficial de sorteo</p>
        </header>

        <Separator />

        <section className="ticket-receipt__raffle" aria-label="Sorteo">
          <p className="ticket-receipt__label">Rifa</p>
          <p className="ticket-receipt__raffle-name">{raffleName}</p>
        </section>

        <section className="ticket-receipt__number" aria-label="Número de ticket">
          <p className="ticket-receipt__label">Número asignado</p>
          <p className="ticket-receipt__number-value">
            {String(ticketNumber).padStart(4, "0")}
          </p>
        </section>

        <Separator />

        <dl className="ticket-receipt__details">
          <TicketRow label="Nombre" value={fullName} />
          <TicketRow label={documentLabel} value={documentNumber} />
          {purchasedAt ? <TicketRow label="Fecha" value={purchasedAt} /> : null}
        </dl>

        <div className="ticket-receipt__reference">
          <p className="ticket-receipt__label">Código único</p>
          <p>
            <span>{ticketReference.slice(0, referenceBreakIndex)}</span>
            <wbr />
            <span>{ticketReference.slice(referenceBreakIndex)}</span>
          </p>
        </div>

        {auditLabel ? (
          <p className="ticket-receipt__audit">
            <span>{auditLabel}</span>
            {printedAt ? <span>{printedAt}</span> : null}
          </p>
        ) : null}

        <div className="ticket-receipt__cut-feed" aria-hidden="true" />
      </article>
    </div>
  );
}

function Separator() {
  return <div className="ticket-receipt__separator" aria-hidden="true" />;
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket-receipt__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
