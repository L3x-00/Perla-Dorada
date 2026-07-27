"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

/* Posiciones de los focos fijos a lo largo de la barra (en % del ancho). */
const FIXED_FIXTURES = [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 98];

/* Tres focos viajan en ritmos distintos sobre las fotos y el escenario. */
const MOVING_LIGHTS = [
  {
    start: "4%",
    end: "92%",
    duration: 6,
    delay: 0,
    light: "#f8d56f",
    beam: "rgba(255, 211, 87, 0.92)",
  },
  {
    start: "-6%",
    end: "86%",
    duration: 8.4,
    delay: 1.15,
    light: "#c98cff",
    beam: "rgba(194, 123, 255, 0.8)",
  },
  {
    start: "10%",
    end: "98%",
    duration: 7.1,
    delay: 2.4,
    light: "#70bdff",
    beam: "rgba(91, 178, 255, 0.78)",
  },
] as const;

export function StageRig() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const carriageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const carriages = carriageRefs.current.filter(
        (carriage): carriage is HTMLDivElement => carriage !== null,
      );

      if (reduceMotion || carriages.length === 0) {
        return;
      }

      const carriageTweens = carriages.map((carriage, index) => {
        const light = MOVING_LIGHTS[index];

        return gsap.to(carriage, {
          left: light.end,
          duration: light.duration,
          delay: light.delay,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      const fixturesTween = gsap.to(".stage-rig-fixture", {
        opacity: () => gsap.utils.random(0.35, 1),
        duration: () => gsap.utils.random(0.7, 1.7),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: {
          each: 0.16,
          repeat: -1,
          yoyoEase: true,
        },
      });

      return () => {
        carriageTweens.forEach((tween) => tween.kill());
        fixturesTween.kill();
      };
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
    >
      <div
        className="absolute inset-y-0 left-0 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(201,162,77,0.78) 0%, rgba(201,162,77,0.16) 35%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(201,162,77,0.78) 0%, rgba(201,162,77,0.16) 35%, transparent 70%)",
        }}
      />

      <div
        className="absolute inset-x-0 top-10 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(201,162,77,0.92) 8%, rgba(201,162,77,0.92) 92%, transparent)",
        }}
      />

      {FIXED_FIXTURES.map((left) => (
        <div
          key={left}
          className="stage-rig-fixture absolute top-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${left}%`,
            width: 9,
            height: 9,
            borderRadius: "9999px",
            background: "var(--color-gold-soft)",
            boxShadow: "0 0 18px 6px rgba(227,206,142,0.78)",
          }}
        />
      ))}

      {MOVING_LIGHTS.map((movingLight, index) => (
        <div
          key={movingLight.light}
          ref={(element) => {
            carriageRefs.current[index] = element;
          }}
          className="absolute top-10 bottom-0 w-[38vw] max-w-[22rem]"
          style={{ left: movingLight.start, opacity: 0.35 }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 14,
              height: 14,
              background: movingLight.light,
              boxShadow: `0 0 26px 10px ${movingLight.beam}`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: "polygon(45% 0%, 55% 0%, 100% 100%, 0% 100%)",
              background: `linear-gradient(180deg, ${movingLight.beam} 0%, ${movingLight.beam} 26%, transparent 88%)`,
              filter: "blur(20px)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      ))}
    </div>
  );
}
