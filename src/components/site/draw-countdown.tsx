"use client";

import { useEffect, useState } from "react";

type DrawCountdownProps = {
  /** Fecha del sorteo en ISO. */
  drawAt: string;
};

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function split(ms: number): Remaining {
  const total = Math.max(Math.floor(ms / 1000), 0);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const UNITS: { key: keyof Remaining; label: string }[] = [
  { key: "days", label: "Días" },
  { key: "hours", label: "Horas" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Seg" },
];

/*
 * Cuenta regresiva hasta el sorteo.
 *
 * Devuelve null hasta montar para evitar desajustes de hidratación: el
 * servidor y el navegador no comparten reloj.
 */
export function DrawCountdown({ drawAt }: DrawCountdownProps) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const target = new Date(drawAt).getTime();

    if (Number.isNaN(target)) {
      return;
    }

    const tick = () => {
      const diff = target - Date.now();
      setFinished(diff <= 0);
      setRemaining(split(diff));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [drawAt]);

  if (!remaining) {
    return null;
  }

  if (finished) {
    return (
      <p className="eyebrow text-gold-soft">El sorteo ya se realizó</p>
    );
  }

  return (
    <div>
      <p className="eyebrow text-muted">Faltan para el sorteo</p>

      <div className="mt-4 flex items-start gap-3 sm:gap-5">
        {UNITS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            <span className="min-w-[3.25rem] rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-center font-display text-3xl font-light tabular-nums text-cream sm:min-w-[4rem] sm:text-4xl">
              {String(remaining[key]).padStart(2, "0")}
            </span>
            <span className="eyebrow mt-2 text-[0.6rem] text-muted">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
