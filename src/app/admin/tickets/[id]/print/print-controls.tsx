"use client";

export function PrintControls() {
  return (
    <div className="mx-auto mb-6 max-w-xl space-y-3 print:hidden">
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
        Configura papel de 80 mm, escala 100 %, márgenes ninguno y desactiva
        encabezados y pies de página. Cada ticket conserva su propio corte.
      </p>
    </div>
  );
}
