"use client";

import { useEffect, useState } from "react";

type CountdownProps = {
  expiresAt: string;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/*
 * Cuenta regresiva en vivo de una reserva. Renderiza null en el primer
 * paint (antes de montar) para evitar desajustes de hidratación, y luego
 * actualiza cada segundo. Es solo informativa: la expiración autoritativa
 * la decide la base de datos.
 */
export function Countdown({ expiresAt }: CountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    if (Number.isNaN(target)) {
      return;
    }

    const tick = () => setRemaining(target - Date.now());

    tick();
    const intervalId = setInterval(tick, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt]);

  if (remaining === null) {
    return null;
  }

  if (remaining <= 0) {
    return (
      <span className="font-semibold text-red-300">La reserva ha vencido.</span>
    );
  }

  return (
    <span className="font-semibold tabular-nums text-amber-300">
      Vence en {formatRemaining(remaining)}
    </span>
  );
}
