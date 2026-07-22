import type { Metadata } from "next";
import Link from "next/link";

import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import {
  getActivePublicRaffle,
  type ActivePublicRaffle,
} from "@/lib/raffles/public-raffle";
import { PurchaseForm } from "./purchase-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rifa vigente · Joyería Perla Dorada",
  description:
    "Participa en la rifa vigente de Joyería Perla Dorada. Elige tu cantidad de boletos y registra tu pago Yape.",
};

export default async function HomePage() {
  let raffle: ActivePublicRaffle | null = null;
  let loadFailed = false;

  try {
    raffle = await getActivePublicRaffle();
  } catch (error) {
    console.error("Error cargando la rifa activa:", error);
    loadFailed = true;
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
            Joyería Perla Dorada
          </p>

          <Link
            href="/seguimiento"
            className="text-sm font-medium text-amber-400 underline-offset-4 hover:underline"
          >
            Consultar mi solicitud
          </Link>
        </header>

        <div className="mt-10">
          {loadFailed ? (
            <StateCard
              title="No pudimos cargar la rifa"
              message="Ocurrió un problema al consultar la rifa vigente. Vuelve a intentarlo en unos minutos."
            />
          ) : !raffle ? (
            <StateCard
              title="No hay una rifa activa"
              message="En este momento no hay ninguna rifa disponible. Vuelve pronto para participar."
            />
          ) : (
            <RaffleContent raffle={raffle} />
          )}
        </div>
      </div>
    </main>
  );
}

function RaffleContent({ raffle }: { raffle: ActivePublicRaffle }) {
  const drawAt = formatDateTime(raffle.drawAt);
  const soldOut = raffle.available <= 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold sm:text-4xl">{raffle.name}</h1>

        {raffle.description ? (
          <p className="mt-4 whitespace-pre-line text-neutral-300">
            {raffle.description}
          </p>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <InfoTile
            label="Precio por boleto"
            value={formatCurrencyPEN(raffle.ticketPrice)}
          />
          <InfoTile
            label="Boletos disponibles"
            value={String(raffle.available)}
          />
          <InfoTile label="Sorteo" value={drawAt ?? "Por definir"} />
        </dl>
      </section>

      {raffle.maintenanceMode ? (
        <StateCard
          title="Portal en mantenimiento"
          message={
            raffle.maintenanceMessage?.trim()
              ? raffle.maintenanceMessage
              : "Estamos realizando tareas de mantenimiento. Por ahora no es posible registrar nuevas solicitudes. Inténtalo más tarde."
          }
        />
      ) : soldOut ? (
        <StateCard
          title="Boletos agotados"
          message="Ya no quedan boletos disponibles para esta rifa. Si tienes una solicitud pendiente, consulta su estado."
        />
      ) : (
        <PurchaseForm
          ticketPrice={raffle.ticketPrice}
          available={raffle.available}
        />
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}

function StateCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-neutral-400">{message}</p>

      <Link
        href="/seguimiento"
        className="mt-5 inline-flex rounded-lg border border-amber-500 px-4 py-3 font-semibold text-amber-400 hover:bg-amber-500/10"
      >
        Consultar mi solicitud
      </Link>
    </section>
  );
}
