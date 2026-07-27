"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import heroBanner from "@/assets/site/hero-banner.webp";
import { ArrowRightIcon } from "@/components/site/icons";
import { brand } from "@/config/brand";

type HeroProps = {
  /** Muestra el acceso directo al sorteo solo si hay uno vigente. */
  hasActiveRaffle: boolean;
};

export function Hero({ hasActiveRaffle }: HeroProps) {
  const reduceMotion = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden">
      {/*
        Imagen de fondo. Se importa como módulo (no como ruta de public/) a
        propósito: Next la sirve con un nombre de archivo con hash de su
        contenido, así que cada vez que se reemplaza la imagen cambia la URL
        y no puede quedar una copia vieja cacheada por el navegador o el CDN
        bajo el mismo nombre.

        object-position 78% 50%: la sección es mucho más alta que ancha en
        móvil (min-h-92vh), así que "cover" recorta en horizontal y solo se
        ve una franja angosta del ancho total. El logo, el título y la caja
        de regalo del banner están concentrados en el lado derecho de la
        imagen (franja 65-91% del ancho); anclar el recorte ahí mantiene esa
        franja visible en cualquier tamaño de pantalla, verificado
        simulando el recorte real en móvil/tablet/escritorio.
      */}
      <div className="absolute inset-0 z-0">
        <Image
          src={heroBanner}
          alt="Fondo de Perla Dorada"
          fill
          placeholder="blur"
          className="object-cover object-[78%_50%]"
          priority
          quality={90}
          sizes="100vw"
          style={{ opacity: 0.5 }}
        />
      </div>

      {/* Overlay oscuro para mejorar legibilidad */}
      <div aria-hidden className="image-scrim absolute inset-0 z-1" />

      {/* Halo dorado muy tenue: da profundidad sin ensuciar el negro */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 z-1 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-gold) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-2 mx-auto w-full max-w-6xl px-6 pt-28 pb-20">
        <motion.p {...rise(0)} className="eyebrow image-gold">
          {brand.tagline}
        </motion.p>

        <motion.h1
          {...rise(0.12)}
          className="image-foreground mt-7 max-w-3xl font-display text-5xl font-light leading-[1.05] sm:text-6xl lg:text-7xl"
        >
          Hoy puedes ganar
          <br />
          <span className="hero-metal italic">premios increíbles</span> con
          <br />
          Perla Dorada
        </motion.h1>

        <motion.p
          {...rise(0.24)}
          className="image-muted mt-8 max-w-md text-base leading-relaxed"
        >
          {brand.description}
        </motion.p>

        <motion.div
          {...rise(0.36)}
          className="mt-11 flex flex-wrap items-center gap-4"
        >
          {hasActiveRaffle ? (
            <Link
              href="#sorteo"
              className="group inline-flex items-center gap-2.5 rounded-full bg-gold px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
            >
              Participar en el sorteo
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
