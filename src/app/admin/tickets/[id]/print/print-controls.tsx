"use client";

export function PrintControls() {
  return (
    <div className="mx-auto mb-6 flex max-w-xl flex-wrap gap-3 print:hidden">
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
  );
}