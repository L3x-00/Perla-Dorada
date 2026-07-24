"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Copiar al portapapeles con degradación.
 *
 * navigator.clipboard solo existe en contexto seguro (HTTPS o localhost).
 * Producción va por HTTPS, pero si alguien abre el sitio por HTTP o desde
 * un navegador viejo cae al método heredado, que sigue funcionando en
 * todos los navegadores actuales aunque esté marcado como obsoleto.
 *
 * Nunca lanza: el llamador decide qué hacer con `false`.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cae al método heredado.
  }

  try {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");

    document.body.removeChild(textarea);

    return copied;
  } catch {
    return false;
  }
}

type ClipboardState = "idle" | "copied" | "failed";

export function useClipboard(resetAfterMs = 2500) {
  const [state, setState] = useState<ClipboardState>("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const copied = await writeToClipboard(text);

      setState(copied ? "copied" : "failed");

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setState("idle");
        timeoutRef.current = null;
      }, resetAfterMs);

      return copied;
    },
    [resetAfterMs],
  );

  return { state, copy };
}
