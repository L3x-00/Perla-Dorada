"use client";

import { PrintProfileSelector } from "@/components/printing/print-profile";

export function PrintControls() {
  return (
    <div className="mx-auto mb-6 max-w-xl space-y-3 print:hidden">
      <PrintProfileSelector />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-cream"
        >
          Imprimir
        </button>

        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-black"
        >
          Cerrar
        </button>
      </div>

      <p className="text-xs leading-relaxed text-neutral-600">
        Elige la impresora en el diálogo del navegador. Cada ticket conserva
        su propia página o corte y cambiar el formato no registra otra
        reimpresión.
      </p>
    </div>
  );
}
