"use client";

import { useState } from "react";

type FestiveLight = "gold" | "violet" | "blue";

const LIGHTS: Array<{ id: FestiveLight; label: string; color: string }> = [
  { id: "gold", label: "Dorada", color: "#f1c24f" },
  { id: "violet", label: "Violeta", color: "#cb7aff" },
  { id: "blue", label: "Azul", color: "#63b5ff" },
];

const SERPENTINES = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
] as const;

/*
 * Las luces son controles reales (teclado y lector de pantalla), no una
 * animación que se dispara sola. La selección actual cambia el baño de color
 * de toda la sección sin interferir con la compra ni con los modales.
 */
export function RaffleCelebration() {
  const [activeLight, setActiveLight] = useState<FestiveLight>("gold");

  return (
    <div
      data-festive-light={activeLight}
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
    >
      <div aria-hidden className="raffle-festive-wash" />
      <div aria-hidden className="raffle-festive-beam raffle-festive-beam--gold" />
      <div
        aria-hidden
        className="raffle-festive-beam raffle-festive-beam--violet"
      />
      <div aria-hidden className="raffle-festive-beam raffle-festive-beam--blue" />

      <div aria-hidden className="absolute inset-0">
        {SERPENTINES.map((name) => (
          <svg
            key={name}
            viewBox="0 0 160 240"
            className={`raffle-serpentine raffle-serpentine--${name}`}
          >
            <path d="M18 4c72 8-4 45 66 61s-20 47 50 64-5 47 26 67-24 31-4 40" />
            <path
              d="M31 8c72 8-4 45 66 61s-20 47 50 64-5 47 26 67-24 31-4 40"
              opacity="0.45"
            />
          </svg>
        ))}
      </div>

      <div className="pointer-events-auto absolute top-5 right-4 z-20 sm:right-6">
        <div
          role="group"
          aria-label="Iluminación festiva de la rifa"
          className="flex items-center gap-1.5 rounded-full border border-line bg-ink/80 p-1.5 shadow-lg backdrop-blur-md"
        >
          <span className="sr-only">Elige el color de las luces</span>
          {LIGHTS.map((light) => {
            const selected = activeLight === light.id;

            return (
              <button
                key={light.id}
                type="button"
                aria-label={`Luz ${light.label}`}
                aria-pressed={selected}
                title={`Luz ${light.label}`}
                onClick={() => setActiveLight(light.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  selected
                    ? "scale-105 border-gold bg-ink-2"
                    : "border-transparent hover:border-line"
                }`}
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full shadow-[0_0_14px_currentColor]"
                  style={{ backgroundColor: light.color, color: light.color }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
