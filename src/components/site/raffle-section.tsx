import { DrawCountdown } from "@/components/site/draw-countdown";
import { HowToParticipate } from "@/components/site/how-to-participate";
import { GemIcon } from "@/components/site/icons";
import { Participate } from "@/components/site/participate";
import { Reveal } from "@/components/site/reveal";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import type { ActivePublicRaffle } from "@/lib/raffles/public-raffle";

type RaffleSectionProps = {
  raffle: ActivePublicRaffle;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd className="mt-2 font-display text-3xl font-light text-cream">
        {value}
      </dd>
    </div>
  );
}

export function RaffleSection({ raffle }: RaffleSectionProps) {
  const drawAt = formatDateTime(raffle.drawAt);
  const soldOut = raffle.available <= 0;
  const vendidos = raffle.totalTickets - raffle.available;
  const progreso =
    raffle.totalTickets > 0
      ? Math.min(Math.round((vendidos / raffle.totalTickets) * 100), 100)
      : 0;

  return (
    <section id="sorteo" className="scroll-mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-gold">Sorteo vigente</p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
              {raffle.name}
            </h2>
            {raffle.description ? (
              <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-muted">
                {raffle.description}
              </p>
            ) : null}
          </div>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Foto del premio */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-line bg-ink-2">
              {raffle.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={raffle.imageUrl}
                  alt={`Premio: ${raffle.name}`}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 text-muted">
                  <GemIcon className="h-10 w-10 text-gold-deep" />
                  <span className="eyebrow">Premio del sorteo</span>
                </div>
              )}
            </div>
          </Reveal>

          {/* Datos + llamada a participar */}
          <Reveal delay={0.1}>
            <div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-6">
                <Stat
                  label="Precio por boleto"
                  value={formatCurrencyPEN(raffle.ticketPrice)}
                />
                <Stat
                  label="Boletos disponibles"
                  value={String(raffle.available)}
                />
              </dl>

              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-muted">Avance del sorteo</span>
                  <span className="text-sm tabular-nums text-gold">
                    {progreso}%
                  </span>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-soft transition-[width] duration-700"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>

              {raffle.drawAt ? (
                <div className="mt-9">
                  <DrawCountdown drawAt={raffle.drawAt} />
                  {drawAt ? (
                    <p className="mt-4 text-sm text-muted">
                      Sorteo el {drawAt}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-10">
                {raffle.maintenanceMode ? (
                  <div className="rounded-2xl border border-line bg-ink-2 p-6">
                    <h3 className="font-display text-xl font-light text-cream">
                      Portal en mantenimiento
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">
                      {raffle.maintenanceMessage?.trim()
                        ? raffle.maintenanceMessage
                        : "Estamos realizando tareas de mantenimiento. Por ahora no es posible registrar nuevas solicitudes. Inténtalo más tarde."}
                    </p>
                  </div>
                ) : soldOut ? (
                  <div className="rounded-2xl border border-line bg-ink-2 p-6">
                    <h3 className="font-display text-xl font-light text-cream">
                      Boletos agotados
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">
                      Ya no quedan boletos para este sorteo. Si tienes una
                      solicitud pendiente, puedes consultar su estado.
                    </p>
                  </div>
                ) : (
                  <>
                    <Participate
                      ticketPrice={raffle.ticketPrice}
                      available={raffle.available}
                      raffleName={raffle.name}
                    />
                    <p className="mt-4 text-sm leading-relaxed text-muted">
                      Completas tus datos, yapeas y subes tu comprobante. La
                      reserva se mantiene mientras validamos tu pago.
                    </p>
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-24">
          <HowToParticipate />
        </div>
      </div>
    </section>
  );
}
