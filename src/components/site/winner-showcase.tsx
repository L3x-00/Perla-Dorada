import { RaffleCelebration } from "@/components/site/raffle-celebration";
import { Reveal } from "@/components/site/reveal";
import { StageRig } from "@/components/site/stage-rig";
import { WinnerCarousel } from "@/components/site/winner-carousel";
import { formatDateTime } from "@/lib/format";
import type { PublicRaffleWinners } from "@/lib/raffles/public-winners";

type WinnerShowcaseProps = {
  winners: PublicRaffleWinners;
};

/*
 * Reemplaza la sección del sorteo en la portada mientras no haya una rifa
 * activa: muestra los ganadores de la última rifa cerrada. En cuanto se
 * active una rifa nueva, esta sección deja de mostrarse (getActivePublicRaffle
 * vuelve a tener resultado y page.tsx pinta RaffleSection en su lugar).
 */
export function WinnerShowcase({ winners }: WinnerShowcaseProps) {
  const drawAt = formatDateTime(winners.drawAt);
  const multiple = winners.winners.length > 1;

  return (
    <section
      id="sorteo"
      className="relative scroll-mt-24 overflow-hidden border-t border-line"
    >
      <StageRig />
      <RaffleCelebration />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-gold">
              {multiple ? "Ganadores del sorteo" : "Ganador del sorteo"}
            </p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
              {winners.raffleName}
            </h2>
            {drawAt ? (
              <p className="mt-5 text-base leading-relaxed text-muted">
                Sorteado el {drawAt}. ¡Gracias a todos los que participaron!
              </p>
            ) : (
              <p className="mt-5 text-base leading-relaxed text-muted">
                ¡Gracias a todos los que participaron!
              </p>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14">
            <WinnerCarousel winners={winners.winners} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
