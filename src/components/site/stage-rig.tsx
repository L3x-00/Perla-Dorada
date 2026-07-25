"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

/*
 * Estructura de escenario para la sección del sorteo: una barra de luces
 * (como un truss de teatro) recorre la parte superior de toda la sección,
 * con soportes verticales a los costados que enmarcan el espacio como un
 * escenario real. Un foco viaja de izquierda a derecha sobre esa barra,
 * arrastrando su haz de luz consigo — como es el mismo elemento el que se
 * desplaza, el haz siempre termina pasando por encima de donde esté la
 * carta del premio, sea que quede a la izquierda (escritorio) o arriba de
 * todo (móvil, donde la cuadrícula se apila).
 *
 * Se usa GSAP (con su integración oficial @gsap/react) en vez de Motion
 * para esto: es un timeline con varias piezas independientes (el foco
 * viajero, el parpadeo de los fijos), justo el caso donde su motor de
 * secuenciación es más cómodo que animar props de React una por una.
 *
 * Todas las posiciones son porcentuales o relativas al contenedor, así que
 * la estructura se adapta a cualquier ancho sin puntos de quiebre.
 */

/** Posiciones de los focos fijos a lo largo de la barra (en % del ancho). */
const FIXED_FIXTURES = [8, 26, 50, 74, 92];

export function StageRig() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const carriageRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion || !carriageRef.current) {
        return;
      }

      const timeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        defaults: { ease: "sine.inOut" },
      });

      timeline.to(carriageRef.current, {
        left: "94%",
        duration: 6,
      });

      /* Parpadeo suave e independiente de cada foco fijo. */
      gsap.to(".stage-rig-fixture", {
        opacity: () => gsap.utils.random(0.35, 0.9),
        duration: () => gsap.utils.random(1.6, 2.8),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: {
          each: 0.4,
          repeat: -1,
          yoyoEase: true,
        },
      });

      return () => {
        timeline.kill();
      };
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Soportes verticales: enmarcan la sección como los costados de un escenario. */}
      <div
        className="absolute inset-y-0 left-0 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(201,162,77,0.55) 0%, rgba(201,162,77,0.12) 35%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(201,162,77,0.55) 0%, rgba(201,162,77,0.12) 35%, transparent 70%)",
        }}
      />

      {/*
        Barra superior (truss): la línea de la que "cuelgan" los focos. Se
        deja un margen desde el borde (top-10, no top-0) a propósito: los
        focos y el foco viajero tienen un halo (box-shadow) centrado sobre
        esta línea, y como la sección tiene overflow-hidden, un halo pegado
        justo al borde quedaba cortado a la mitad contra la sección del
        Hero que viene arriba. Con este margen el halo completo cabe dentro
        de los límites de la sección.
      */}
      <div
        className="absolute inset-x-0 top-10 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(201,162,77,0.7) 8%, rgba(201,162,77,0.7) 92%, transparent)",
        }}
      />

      {/* Focos fijos: puntos de luz tenues repartidos en la barra. */}
      {FIXED_FIXTURES.map((left, index) => (
        <div
          key={index}
          className="stage-rig-fixture absolute top-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${left}%`,
            width: 8,
            height: 8,
            borderRadius: "9999px",
            background: "var(--color-gold-soft)",
            boxShadow: "0 0 14px 4px rgba(227,206,142,0.65)",
          }}
        />
      ))}

      {/*
        Foco viajero: se anima con GSAP (left, en %). El haz es hijo suyo,
        así que se desplaza junto con el foco sin animarlo por separado.
        Empieza en top-10 (igual que la barra) y baja hasta el fondo.
      */}
      <div
        ref={carriageRef}
        className="absolute top-10 bottom-0 w-[38vw] max-w-[22rem]"
        style={{ left: "6%" }}
      >
        {/* Housing del foco, sobre la barra */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: "var(--color-gold-soft)",
            boxShadow: "0 0 22px 8px rgba(227,206,142,0.85)",
          }}
        />

        {/* Haz de luz que cae del foco hacia la sección */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)",
            background:
              "linear-gradient(180deg, rgba(227,206,142,0.8) 0%, rgba(201,162,77,0.3) 40%, rgba(201,162,77,0.08) 68%, transparent 88%)",
            filter: "blur(20px)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
  );
}
