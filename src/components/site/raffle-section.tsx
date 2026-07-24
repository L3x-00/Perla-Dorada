import { DrawCountdown } from "@/components/site/draw-countdown";
import { HowToParticipate } from "@/components/site/how-to-participate";
import { Participate } from "@/components/site/participate";
import { PrizeShowcase } from "@/components/site/prize-showcase";
import { Reveal } from "@/components/site/reveal";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import type { ActivePublicRaffle } from "@/lib/raffles/public-raffle";

/*
 * Si el sorteo aún no tiene fotos propias, la vitrina muestra las piezas de
 * marca de public/marca/og para no quedar vacía y seguir animando.
 */
const FALLBACK_PRIZE_IMAGES = ["/marca/og/moto2.webp", "/marca/og/moto.webp"];

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

  /*
   * Vitrina: foto del premio mayor + fotos de cada premio de la lista, sin
   * repetir. Si no hay ninguna, se recurre a las piezas de marca.
   */
  const prizeImages = raffle.prizes
    .map((prize) => prize.imageUrl)
    .filter((url): url is string => url !== null);

  const showcaseImages = [
    ...new Set(
      [raffle.imageUrl, ...prizeImages].filter(
        (url): url is string => url !== null,
      ),
    ),
  ];

  const images =
    showcaseImages.length > 0 ? showcaseImages : FALLBACK_PRIZE_IMAGES;

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
          {/* Vitrina del premio (fundido + destellos) */}
          <Reveal>
            <PrizeShowcase images={images} alt={`Premio: ${raffle.name}`} />
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

              {raffle.prizes.length > 0 ? (
                <div className="mt-8">
                  <p className="eyebrow text-muted">
                    {raffle.prizes.length === 1 ? "Premio" : "Premios"}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {raffle.prizes.map((prize, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-3 border-t border-line pt-3"
                      >
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gold/40 px-2 text-sm tabular-nums text-gold">
                          {prize.quantity}
                        </span>
                        <span className="text-cream">{prize.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
