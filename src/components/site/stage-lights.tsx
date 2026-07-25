"use client";

import { motion, useReducedMotion } from "motion/react";

/*
 * Luces de escenario a ambos extremos de la sección del sorteo: dos haces
 * dorados que "iluminan" el premio desde las esquinas, como los focos de un
 * escenario. Cada uno oscila (cambia de ángulo) y respira en intensidad de
 * forma independiente, para que se sientan como dos focos reales y no como
 * una animación sincronizada y mecánica.
 *
 * Es decorativo y puramente visual: pointer-events-none, y se desactiva si
 * el sistema pide menos movimiento (queda un brillo fijo, sin oscilar).
 */
export function StageLights() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <Beam
        side="left"
        reduceMotion={!!reduceMotion}
        rotateRange={[-11, -3]}
        duration={9}
      />
      <Beam
        side="right"
        reduceMotion={!!reduceMotion}
        rotateRange={[11, 3]}
        duration={11}
      />
    </div>
  );
}

type BeamProps = {
  side: "left" | "right";
  reduceMotion: boolean;
  /** [ángulo de reposo, ángulo de barrido] en grados. */
  rotateRange: [number, number];
  duration: number;
};

function Beam({ side, reduceMotion, rotateRange, duration }: BeamProps) {
  const [restAngle, sweepAngle] = rotateRange;

  /*
   * Forma de haz de luz: un trapecio angosto arriba (el foco) que se abre
   * hacia abajo, como un cono de luz de escenario. El degradado se atenúa
   * hacia la base para que no se vea como una forma sólida.
   */
  const clipPath =
    side === "left"
      ? "polygon(38% 0%, 62% 0%, 118% 100%, -30% 100%)"
      : "polygon(38% 0%, 62% 0%, 130% 100%, -18% 100%)";

  return (
    <motion.div
      className={`absolute inset-y-0 ${side === "left" ? "left-0 origin-top" : "right-0 origin-top"} w-[46vw] max-w-[26rem]`}
      style={{
        clipPath,
        background:
          "linear-gradient(180deg, rgba(227,206,142,0.75) 0%, rgba(201,162,77,0.32) 38%, rgba(201,162,77,0.08) 70%, transparent 92%)",
        filter: "blur(22px)",
        mixBlendMode: "screen",
      }}
      initial={false}
      animate={
        reduceMotion
          ? { rotate: restAngle, opacity: 0.55 }
          : {
              rotate: [restAngle, sweepAngle, restAngle],
              opacity: [0.4, 0.8, 0.4],
            }
      }
      transition={
        reduceMotion
          ? undefined
          : {
              duration,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
    />
  );
}
