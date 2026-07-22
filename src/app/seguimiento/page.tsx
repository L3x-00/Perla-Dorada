import { TrackingForm } from "@/app/seguimiento/tracking-form";

export const metadata = {
  title:
    "Seguimiento | Joyería Perla Dorada",
  description:
    "Consulta el estado de tu solicitud de participación.",
};

export default function TrackingPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <header className="mx-auto mb-8 max-w-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
          Joyería Perla Dorada
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Seguimiento de
          solicitud
        </h1>

        <p className="mt-3 text-neutral-400">
          Ingresa el DNI y el
          código de seguimiento
          entregado al registrar
          tu solicitud.
        </p>
      </header>

      <TrackingForm />
    </main>
  );
}