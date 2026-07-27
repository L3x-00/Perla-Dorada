"use client";

import { useState, type CSSProperties } from "react";

type FestiveLight = "gold" | "violet" | "blue";
type SerpentineTone = "gold" | "violet" | "blue" | "pink" | "aqua" | "lilac";

const LIGHTS: Array<{ id: FestiveLight; label: string; color: string }> = [
  { id: "gold", label: "Dorada", color: "#f1c24f" },
  { id: "violet", label: "Violeta", color: "#cb7aff" },
  { id: "blue", label: "Azul", color: "#63b5ff" },
];

const SERPENTINE_TONES: SerpentineTone[] = [
  "gold",
  "violet",
  "blue",
  "pink",
  "aqua",
  "lilac",
];

/* Más densidad y posiciones deterministas: no rompe la hidratación. */
const SERPENTINES = Array.from({ length: 42 }, (_, index) => {
  const leftColumn = index % 2 === 0;
  const style: CSSProperties = {
    top: `${4 + ((index * 17) % 88)}%`,
    left: `${leftColumn ? -8 + ((index * 11) % 24) : 84 + ((index * 13) % 20)}%`,
    animationDelay: `-${(index * 0.43).toFixed(2)}s`,
    animationDuration: `${2.7 + (index % 4) * 0.42}s`,
  };

  return {
    id: `serpentine-${index}`,
    tone: SERPENTINE_TONES[index % SERPENTINE_TONES.length],
    style,
  };
});

/*
 * Las luces son controles reales (teclado y lector de pantalla), no una
 * animación que se dispara sola. La selección cambia el baño de color de
 * toda la sección sin interferir con la compra ni con los modales.
 */
export function RaffleCelebration() {
  const [activeLight, setActiveLight] = useState<FestiveLight>("gold");

  return (
    <>
      <div
        aria-hidden
        data-festive-light={activeLight}
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      >
        <div className="raffle-festive-wash" />
        <div className="raffle-festive-beam raffle-festive-beam--gold" />
        <div className="raffle-festive-beam raffle-festive-beam--violet" />
        <div className="raffle-festive-beam raffle-festive-beam--blue" />

        <div className="absolute inset-0">
          {SERPENTINES.map((serpentine) => (
            <svg
              key={serpentine.id}
              viewBox="0 0 160 240"
              style={serpentine.style}
              className={`raffle-serpentine raffle-serpentine--${serpentine.tone}`}
            >
              <path d="M18 4c72 8-4 45 66 61s-20 47 50 64-5 47 26 67-24 31-4 40" />
              <path
                d="M31 8c72 8-4 45 66 61s-20 47 50 64-5 47 26 67-24 31-4 40"
                opacity="0.45"
              />
            </svg>
          ))}
        </div>
      </div>

      <div className="pointer-events-auto absolute top-5 right-4 z-30 sm:right-6">
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
    </>
  );
}
