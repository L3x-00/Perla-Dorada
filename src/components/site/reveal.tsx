"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso en segundos, para escalonar elementos hermanos. */
  delay?: number;
  /** Desplazamiento vertical inicial en píxeles. */
  offset?: number;
};

/*
 * Aparición al entrar en pantalla.
 *
 * Movimiento corto y curva lenta al final: es lo que separa una animación
 * elegante de una "de plantilla". Se ejecuta una sola vez —repetir en cada
 * scroll cansa— y se desactiva si el sistema pide menos movimiento.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  offset = 24,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.9,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
