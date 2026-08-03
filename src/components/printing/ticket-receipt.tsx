import { brand } from "@/config/brand";
import { formatTicketCode } from "@/lib/tickets/code";

type TicketReceiptProps = {
  raffleName: string;
  fullName: string;
  documentLabel: string;
  documentNumber: string;
  purchasedAt: string | null;
  ticketNumber: number;
  printOnly?: boolean;
  hiddenForPrint?: boolean;
  isLastForPrint?: boolean;
};

export function TicketReceipt({
  raffleName,
  fullName,
  documentLabel,
  documentNumber,
  purchasedAt,
  ticketNumber,
  printOnly = false,
  hiddenForPrint = false,
  isLastForPrint = false,
}: TicketReceiptProps) {
  const visibilityClass = hiddenForPrint
    ? "hidden"
    : printOnly
      ? "hidden print:block"
      : "";
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
          <p className="ticket-receipt__label">Código del ticket</p>
          <p className="ticket-receipt__number-value">
            {formatTicketCode(ticketNumber)}
          </p>
        </section>

        <Separator />

        <dl className="ticket-receipt__details">
          <TicketRow label="Nombre" value={fullName} />
          <TicketRow label={documentLabel} value={documentNumber} />
          {purchasedAt ? <TicketRow label="Fecha" value={purchasedAt} /> : null}
        </dl>

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
