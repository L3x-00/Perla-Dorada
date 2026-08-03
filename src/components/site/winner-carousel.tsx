"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/site/icons";
import type { PublicRaffleWinnerEntry } from "@/lib/raffles/public-winners";

const AUTOPLAY_INTERVAL_MS = 6000;

type WinnerCarouselProps = {
  winners: PublicRaffleWinnerEntry[];
};

/*
 * Navegación entre los premios/ganadores de la última rifa cerrada. Un
 * solo premio: se muestra fijo, sin controles (mismo criterio que
 * PromoIndicators/PromoNavigation). Autoplay lento, pausa en hover,
 * respeta reduced motion.
 */
export function WinnerCarousel({ winners }: WinnerCarouselProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((current) => (current + 1) % winners.length);
  }, [winners.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((current) => (current - 1 + winners.length) % winners.length);
  }, [winners.length]);

  const goToIndex = useCallback(
    (target: number) => {
      setDirection(target > index ? 1 : -1);
      setIndex(target);
    },
    [index],
  );

  useEffect(() => {
    if (paused || reduceMotion || winners.length <= 1) {
      return;
    }

    const timer = window.setInterval(goNext, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, winners.length, goNext]);

  const active = winners[index];

  return (
    <div
      className="relative mx-auto max-w-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-gold-deep/50 bg-ink-2 shadow-2xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${active.prizeId ?? "single"}-${active.ticketNumber}`}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 30 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -30 }
            }
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <WinnerSlide winner={active} />
          </motion.div>
        </AnimatePresence>

        {winners.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Premio anterior"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Siguiente premio"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      {winners.length > 1 ? (
        <div
          role="tablist"
          aria-label="Premios"
          className="mt-5 flex items-center justify-center gap-2"
        >
          {winners.map((winner, winnerIndex) => {
            const isActive = winnerIndex === index;

            return (
              <button
                key={`${winner.prizeId ?? "single"}-${winner.ticketNumber}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ver premio ${winnerIndex + 1} de ${winners.length}`}
                onClick={() => goToIndex(winnerIndex)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isActive ? "w-6 bg-gold" : "w-1.5 bg-line hover:bg-gold/50"
                }`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WinnerSlide({ winner }: { winner: PublicRaffleWinnerEntry }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-ink-3 via-ink-2 to-ink">
      {winner.prizeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={winner.prizeImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />

      <div className="absolute inset-x-0 bottom-0 p-6 text-center sm:p-8">
        <p className="eyebrow text-gold">{winner.prizeTitle}</p>

        <p className="mt-3 font-display text-3xl font-light text-cream sm:text-4xl">
          🏆 {winner.winnerDisplayName}
        </p>

        {winner.winnerLocation ? (
          <p className="mt-2 text-sm text-cream/80">
            Compró en {winner.winnerLocation}
          </p>
        ) : null}

        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted">
          Ticket ganador
        </p>
        <p className="mt-1 font-display text-4xl font-light tabular-nums text-gold-soft sm:text-5xl">
          {String(winner.ticketNumber).padStart(4, "0")}
        </p>
      </div>
    </div>
  );
}
