"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PUBLIC_RAFFLE_CHANNEL } from "@/lib/realtime/channels";
import { createClient } from "@/lib/supabase/client";

/*
 * No renderiza nada: solo escucha la señal de cambios de rifas y refresca la
 * página del servidor (Server Component) para volver a consultar el estado
 * real. Nunca confía en el payload del evento, solo en que "algo cambió".
 */
export function RealtimeRaffleWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(PUBLIC_RAFFLE_CHANNEL)
      .on("broadcast", { event: "changed" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
