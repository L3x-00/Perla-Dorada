"use client";

import { useState, type CSSProperties } from "react";

type FestiveLight = "gold" | "violet" | "blue";
type StarTone = "gold" | "violet" | "blue" | "pink" | "aqua" | "lilac";

const LIGHTS: Array<{ id: FestiveLight; label: string; color: string }> = [
  { id: "gold", label: "Dorada", color: "#f1c24f" },
  { id: "violet", label: "Violeta", color: "#cb7aff" },
  { id: "blue", label: "Azul", color: "#63b5ff" },
];

const STAR_TONES: StarTone[] = [
  "gold",
  "violet",
  "blue",
  "pink",
  "aqua",
  "lilac",
];

/* Posiciones deterministas para que las estrellas no rompan la hidratación. */
const TWINKLE_STARS = Array.from({ length: 42 }, (_, index) => {
  const leftColumn = index % 2 === 0;
  const style: CSSProperties = {
    top: `${4 + ((index * 17) % 88)}%`,
    left: `${leftColumn ? -2 + ((index * 11) % 26) : 77 + ((index * 13) % 22)}%`,
    animationDelay: `-${(index * 0.43).toFixed(2)}s`,
    animationDuration: `${2.4 + (index % 4) * 0.38}s`,
  };

  return {
    id: `star-${index}`,
    tone: STAR_TONES[index % STAR_TONES.length],
    style,
  };
});

/* Las tres luces son controles; la paleta elegida también realza sus estrellas. */
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
          {TWINKLE_STARS.map((star) => (
            <svg
              key={star.id}
              viewBox="0 0 24 24"
              style={star.style}
              className={`raffle-twinkle raffle-twinkle--${star.tone}`}
            >
              <path d="M12 0 14.2 9.8 24 12l-9.8 2.2L12 24l-2.2-9.8L0 12l9.8-2.2Z" />
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
