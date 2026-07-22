import Link from "next/link";
import { redirect } from "next/navigation";

import { RaffleActions } from "./raffle-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const raffleStatusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const raffleStatusClasses: Record<string, string> = {
  draft:
    "border-amber-800 bg-amber-950/50 text-amber-300",
  active:
    "border-emerald-800 bg-emerald-950/50 text-emerald-300",
  closed:
    "border-neutral-700 bg-neutral-900 text-neutral-300",
  cancelled:
    "border-red-800 bg-red-950/50 text-red-300",
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Sin definir";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function RafflesPage() {
  const sessionClient = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await sessionClient.auth.getClaims();

  if (
    claimsError ||
    typeof claimsData?.claims?.sub !== "string"
  ) {
    redirect("/admin/login");
  }

  const adminClient = createAdminClient();

  const {
    data: raffles,
    error: rafflesError,
  } = await adminClient
    .from("raffles")
    .select(
      `
        id,
        name,
        description,
        status,
        ticket_price,
        total_tickets,
        starts_at,
        closes_at,
        draw_at,
        closed_at,
        created_at
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (rafflesError) {
    console.error("Error cargando rifas:", {
      code: rafflesError.code,
      message: rafflesError.message,
      details: rafflesError.details,
      hint: rafflesError.hint,
    });
  }

  const raffleList = raffles ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-400">
              Joyería Perla Dorada
            </p>

            <h1 className="mt-1 text-3xl font-semibold">
              Administración de rifas
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Crea, configura y controla el estado de las
              rifas disponibles en el sistema.
            </p>
          </div>

          <Link
            href="/admin/raffles/new"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300"
          >
            Nueva rifa
          </Link>
        </header>

        {rafflesError ? (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            No se pudieron cargar las rifas.
          </div>
        ) : null}

        {!rafflesError && raffleList.length === 0 ? (
          <section className="mt-8 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">
              No existen rifas
            </h2>

            <p className="mt-2 text-sm text-neutral-400">
              Crea la primera rifa para comenzar a recibir
              solicitudes de compra.
            </p>

            <Link
              href="/admin/raffles/new"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300"
            >
              Crear primera rifa
            </Link>
          </section>
        ) : null}

        {raffleList.length > 0 ? (
          <div className="mt-8 grid gap-5">
            {raffleList.map((raffle) => {
              const statusLabel =
                raffleStatusLabels[raffle.status] ??
                raffle.status;

              const statusClass =
                raffleStatusClasses[raffle.status] ??
                "border-neutral-700 bg-neutral-900 text-neutral-300";

              return (
                <article
                  key={raffle.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold">
                          {raffle.name}
                        </h2>

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {raffle.description ? (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
                          {raffle.description}
                        </p>
                      ) : null}

                      <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-neutral-500">
                            Precio
                          </dt>

                          <dd className="mt-1 font-medium text-neutral-100">
                            {formatMoney(
                              Number(raffle.ticket_price),
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs uppercase tracking-wide text-neutral-500">
                            Tickets
                          </dt>

                          <dd className="mt-1 font-medium text-neutral-100">
                            {raffle.total_tickets}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs uppercase tracking-wide text-neutral-500">
                            Inicio
                          </dt>

                          <dd className="mt-1 text-sm text-neutral-300">
                            {formatDate(raffle.starts_at)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs uppercase tracking-wide text-neutral-500">
                            Cierre
                          </dt>

                          <dd className="mt-1 text-sm text-neutral-300">
                            {formatDate(raffle.closes_at)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs uppercase tracking-wide text-neutral-500">
                            Sorteo
                          </dt>

                          <dd className="mt-1 text-sm text-neutral-300">
                            {formatDate(raffle.draw_at)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-3">
                      <RaffleActions
                        raffleId={raffle.id}
                        status={raffle.status}
                      />

                      {raffle.status === "closed" ? (
                        <Link
                          href={`/admin/raffles/${raffle.id}/winner`}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-500 px-4 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/10"
                        >
                          Ganador
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}