import Link from "next/link";
import { redirect } from "next/navigation";

import { RaffleActions } from "./raffle-actions";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
  btnGhost,
  btnPrimary,
  btnSmall,
  type BadgeTone,
} from "@/components/admin/ui";
import { formatCurrencyPEN } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const raffleStatusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const raffleStatusTones: Record<string, BadgeTone> = {
  draft: "pending",
  active: "approved",
  closed: "neutral",
  cancelled: "rejected",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Sin definir";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function RafflesPage() {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  if (claimsError || typeof claimsData?.claims?.sub !== "string") {
    redirect("/admin/login");
  }

  const adminClient = createAdminClient();

  const { data: raffles, error: rafflesError } = await adminClient
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
    .order("created_at", { ascending: false });

  if (rafflesError) {
    console.error("Error cargando rifas:", rafflesError);
  }

  const raffleList = raffles ?? [];

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Administración de rifas"
        description="Crea, configura y controla el estado de las rifas del sistema."
        action={
          <Link href="/admin/raffles/new" className={btnPrimary}>
            Nueva rifa
          </Link>
        }
      />

      {rafflesError ? (
        <div className="mt-8">
          <AdminAlert>No se pudieron cargar las rifas.</AdminAlert>
        </div>
      ) : null}

      {!rafflesError && raffleList.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No existen rifas"
            description="Crea la primera rifa para comenzar a recibir solicitudes."
            action={
              <Link href="/admin/raffles/new" className={btnPrimary}>
                Crear primera rifa
              </Link>
            }
          />
        </div>
      ) : null}

      {raffleList.length > 0 ? (
        <div className="mt-8 grid gap-4">
          {raffleList.map((raffle) => (
            <article
              key={raffle.id}
              className="rounded-xl border border-line bg-ink-2 p-5"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl font-light text-cream">
                      {raffle.name}
                    </h2>

                    <Badge tone={raffleStatusTones[raffle.status] ?? "neutral"}>
                      {raffleStatusLabels[raffle.status] ?? raffle.status}
                    </Badge>
                  </div>

                  {raffle.description ? (
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                      {raffle.description}
                    </p>
                  ) : null}

                  <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
                    <Field
                      label="Precio"
                      value={formatCurrencyPEN(Number(raffle.ticket_price))}
                      strong
                    />
                    <Field
                      label="Tickets"
                      value={String(raffle.total_tickets)}
                      strong
                    />
                    <Field label="Inicio" value={formatDate(raffle.starts_at)} />
                    <Field label="Cierre" value={formatDate(raffle.closes_at)} />
                    <Field label="Sorteo" value={formatDate(raffle.draw_at)} />
                  </dl>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-3">
                  <RaffleActions
                    raffleId={raffle.id}
                    raffleName={raffle.name}
                    status={raffle.status}
                  />

                  {raffle.status === "closed" ? (
                    <Link
                      href={`/admin/raffles/${raffle.id}/winner`}
                      className={`${btnGhost} ${btnSmall}`}
                    >
                      Ganador
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </AdminPage>
  );
}

function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd
        className={
          strong ? "mt-1.5 font-medium text-cream" : "mt-1.5 text-sm text-muted"
        }
      >
        {value}
      </dd>
    </div>
  );
}
