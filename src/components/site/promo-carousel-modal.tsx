"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/site/icons";
import { PromoIndicators } from "@/components/site/promo-indicators";
import { PromoNavigation } from "@/components/site/promo-navigation";
import { PromoSlide } from "@/components/site/promo-slide";
import type { PublicPromotion } from "@/lib/promotions/public-promotions";
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll";

const AUTO_OPEN_DELAY_MS = 2000;
const AUTOPLAY_INTERVAL_MS = 5000;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};

/*
 * document.body no existe durante el render en el servidor: el portal solo
 * puede crearse una vez montados en el cliente. useSyncExternalStore evita
 * el cascading render que el linter de hooks marca como error en un
 * setState dentro de useEffect (mismo patrón que Participate).
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

type PromoCarouselModalProps = {
  /*
   * Ya filtradas por vigencia y `enabled` en el servidor
   * (getActivePublicPromotions, llamada desde page.tsx) — el componente no
   * vuelve a filtrar, solo las muestra.
   */
  promotions: PublicPromotion[];
};

/*
 * Modal de bienvenida con carrusel de promociones.
 *
 * Se abre en cada carga de la portada, 2 segundos después, si hay al menos
 * una promoción vigente. Así, una promoción nueva se muestra sin esperar a
 * que termine una sesión anterior.
 */
export function PromoCarouselModal({ promotions }: PromoCarouselModalProps) {
  const reduceMotion = useReducedMotion();
  const mounted = useMounted();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useLockBodyScroll(open);

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((current) => (current + 1) % promotions.length);
  }, [promotions.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex(
      (current) => (current - 1 + promotions.length) % promotions.length,
    );
  }, [promotions.length]);

  const goToIndex = useCallback(
    (target: number) => {
      setDirection(target > index ? 1 : -1);
      setIndex(target);
    },
    [index],
  );

  // Apertura automática en cada carga de la portada.
  useEffect(() => {
    if (promotions.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, AUTO_OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [promotions.length]);

  // Autoplay: cada 5s, salvo hover, reduced motion, cerrado o un solo slide.
  useEffect(() => {
    if (!open || paused || reduceMotion || promotions.length <= 1) {
      return;
    }

    const timer = window.setInterval(goNext, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, paused, reduceMotion, promotions.length, goNext, index]);

  // Escape cierra; el foco inicial va al botón de cerrar.
  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Trampa de foco: Tab no debe escapar del diálogo mientras está abierto.
  useEffect(() => {
    if (!open) {
      return;
    }

    const container = dialogRef.current;

    if (!container) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !container) {
        return;
      }

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!mounted || promotions.length === 0) {
    return null;
  }

  const active = promotions[index];

  /*
   * El portal envuelve a AnimatePresence completo (nunca al revés):
   * AnimatePresence filtra sus hijos con React.isValidElement, y un
   * ReactPortal no lo es — anidarlo adentro hace que se descarte en
   * silencio y no se renderice nada.
   */
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="promo-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={close}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Promociones de Joyería Perla Dorada"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }
            }
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="Cerrar promociones"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              <CloseIcon className="h-4 w-4" />
            </button>

            <div className="relative overflow-hidden rounded-t-2xl">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.id}
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction * 30 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction * -30 }
                  }
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PromoSlide
                    promo={active}
                    eager={index === 0}
                    onCtaClick={close}
                  />
                </motion.div>
              </AnimatePresence>

              {promotions.length > 1 ? (
                <PromoNavigation onPrev={goPrev} onNext={goNext} />
              ) : null}
            </div>

            {promotions.length > 1 ? (
              <div className="px-4 pb-4 pt-3">
                <PromoIndicators
                  count={promotions.length}
                  activeIndex={index}
                  onSelect={goToIndex}
                />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
