"use client";

import { useEffect } from "react";

/** Bloquea el scroll del body mientras `active` es true (p. ej. un modal abierto). */
export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
