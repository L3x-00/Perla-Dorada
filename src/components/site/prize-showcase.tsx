"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { GemIcon } from "@/components/site/icons";

type PrizeShowcaseProps = {
  /** URLs de las fotos a mostrar, en orden. Vacío = marcador. */
  images: string[];
  alt: string;
};

/*
 * Posiciones fijas de los destellos (nada de Math.random: rompería la
 * hidratación y haría bailar las chispas en cada render). Recorren el borde
 * del marco imitando los brillos del logotipo.
 */
const SPARKLES = [
  { left: "7%", top: "14%", size: 11, delay: 0 },
  { left: "89%", top: "9%", size: 14, delay: 0.7 },
  { left: "17%", top: "80%", size: 9, delay: 1.2 },
  { left: "92%", top: "63%", size: 12, delay: 0.35 },
  { left: "49%", top: "5%", size: 9, delay: 1.7 },
  { left: "79%", top: "88%", size: 13, delay: 1.0 },
  { left: "5%", top: "46%", size: 8, delay: 2.1 },
  { left: "95%", top: "35%", size: 10, delay: 1.4 },
  { left: "31%", top: "92%", size: 10, delay: 0.55 },
  { left: "64%", top: "17%", size: 8, delay: 2.4 },
  { left: "23%", top: "29%", size: 7, delay: 1.9 },
  { left: "83%", top: "49%", size: 9, delay: 0.2 },
];

const ROTATE_MS = 4200;

/*
 * Vitrina del premio: cruza suavemente entre las fotos con un fundido y un
 * leve zoom, sobre un halo dorado que respira y una lluvia de destellos. Todo
 * se apaga si el sistema pide menos movimiento (prefers-reduced-motion): ahí
 * queda una sola foto quieta.
 */
export function PrizeShowcase({ images, alt }: PrizeShowcaseProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const sheenRef = useRef<HTMLDivElement | null>(null);

  const hasImages = images.length > 0;
  const canRotate = images.length > 1 && !reduceMotion;

  useEffect(() => {
    if (!canRotate) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [canRotate, images.length]);

  /*
   * El foco viajero del "escenario" (StageRig, arriba de toda la sección)
   * recorre el ancho completo, así que en algún punto pasa por encima de
   * esta carta. Este barrido replica ese destello directamente SOBRE la
   * imagen: un brillo diagonal que cruza el recuadro y vuelve a pasar cada
   * pocos segundos, como si la luz del escenario se reflejara en la pieza.
   */
  useGSAP(
    () => {
      if (reduceMotion || !hasImages || !sheenRef.current) {
        return;
      }

      const tween = gsap.fromTo(
        sheenRef.current,
        { left: "-45%" },
        {
          left: "145%",
          duration: 1.7,
          ease: "power1.inOut",
          repeat: -1,
          repeatDelay: 3.6,
        },
      );

      return () => {
        tween.kill();
      };
    },
    { scope: sheenRef, dependencies: [reduceMotion, hasImages] },
  );

  const safeIndex = hasImages ? index % images.length : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-ink-2 to-ink">
      {!reduceMotion && hasImages ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(58% 50% at 50% 42%, rgba(201,162,77,0.18), transparent 70%)",
          }}
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <div className="relative z-10 aspect-[3/4] w-full">
        {hasImages ? (
          <AnimatePresence mode="sync">
            <motion.img
              key={`${safeIndex}-${images[safeIndex]}`}
              src={images[safeIndex]}
              alt={alt}
              className="absolute inset-0 h-full w-full object-contain p-3 sm:p-4"
              initial={reduceMotion ? false : { opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted">
            <GemIcon className="h-10 w-10 text-gold-deep" />
            <span className="eyebrow">Premio del sorteo</span>
          </div>
        )}

        {!reduceMotion && hasImages ? (
          <div
            ref={sheenRef}
            aria-hidden
            className="pointer-events-none absolute top-[-25%] h-[150%] w-1/3 rotate-[18deg]"
            style={{
              left: "-45%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,248,230,0.6), transparent)",
              filter: "blur(3px)",
              mixBlendMode: "screen",
            }}
          />
        ) : null}
      </div>

      {!reduceMotion && hasImages ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
          {SPARKLES.map((sparkle, i) => (
            <motion.span
              key={i}
              className="absolute text-gold-soft"
              style={{
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.4, 1, 0.4],
                y: [0, -6, 0],
              }}
              transition={{
                duration: 2.8,
                delay: sparkle.delay,
                repeat: Infinity,
                repeatDelay: 1.3,
                ease: "easeInOut",
              }}
            >
              <Sparkle />
            </motion.span>
          ))}
        </div>
      ) : null}

      {/* Puntos de posición cuando hay varias fotos. */}
      {hasImages && images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === safeIndex ? "w-5 bg-gold" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Destello de cuatro puntas, como los brillos del logotipo. */
function Sparkle() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full drop-shadow-[0_0_4px_rgba(201,162,77,0.6)]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0 L13.6 10.4 L24 12 L13.6 13.6 L12 24 L10.4 13.6 L0 12 L10.4 10.4 Z" />
    </svg>
  );
}
