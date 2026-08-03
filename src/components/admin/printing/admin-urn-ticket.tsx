import "server-only";

import { formatTicketCode } from "@/lib/tickets/code";

type AdminUrnTicketProps = {
  ticketNumber: number;
  purchasedAt: string;
  fullName: string;
  phone: string;
  isLastForPrint?: boolean;
};

/**
 * Talón mínimo para las ánforas. Es deliberadamente independiente del
 * comprobante público para que el teléfono nunca se filtre allí por error.
 */
export function AdminUrnTicket({
  ticketNumber,
  purchasedAt,
  fullName,
  phone,
  isLastForPrint = false,
}: AdminUrnTicketProps) {
  const normalizedName = fullName.trim().toLocaleUpperCase("es-PE");
  const nameScale = Math.min(1, 32 / Math.max(normalizedName.length, 1));

  return (
    <div
      className="urn-ticket-print"
      style={isLastForPrint ? { breakAfter: "auto" } : undefined}
    >
      <article
        className="urn-ticket-receipt"
        aria-label={`Ticket ${formatTicketCode(ticketNumber)}`}
      >
        <p className="urn-ticket-receipt__code">
          {formatTicketCode(ticketNumber)}
        </p>
        <time className="urn-ticket-receipt__date">{purchasedAt}</time>
        <p className="urn-ticket-receipt__name">
          <span
            style={{
              display: "block",
              width: `${100 / nameScale}%`,
              transform: `scaleX(${nameScale})`,
              transformOrigin: "left center",
            }}
          >
            {normalizedName}
          </span>
        </p>
        <p className="urn-ticket-receipt__phone">{phone}</p>
      </article>
    </div>
  );
}
