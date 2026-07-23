import type { Metadata } from "next";

import { TrackingForm } from "@/app/seguimiento/tracking-form";

export const metadata: Metadata = {
  title: "Seguimiento de solicitud",
  description: "Consulta el estado de tu solicitud de participación.",
};

export default function TrackingPage() {
  return (
    <div className="px-6 pt-32 pb-24">
      <header className="mx-auto mb-10 max-w-lg">
        <p className="eyebrow text-gold">Seguimiento</p>

        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-cream">
          Consulta tu solicitud
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          Ingresa el DNI y el código de seguimiento que recibiste al registrar
          tu solicitud.
        </p>
      </header>

      <TrackingForm />
    </div>
  );
}
