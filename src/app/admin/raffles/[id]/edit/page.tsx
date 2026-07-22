import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RaffleForm,
  type RaffleFormValues,
} from "../../raffle-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EditRafflePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toDateTimeLocal(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMilliseconds =
    date.getTimezoneOffset() * 60_000;

  return new Date(
    date.getTime() - offsetMilliseconds,
  )
    .toISOString()
    .slice(0, 16);
}

export default async function EditRafflePage({
  params,
}: EditRafflePageProps) {
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

  const { id } = await params;

  const adminClient = createAdminClient();

  const {
    data: raffle,
    error: raffleError,
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
        draw_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (raffleError) {
    console.error(
      "Error cargando rifa para editar:",
      {
        code: raffleError.code,
        message: raffleError.message,
        details: raffleError.details,
        hint: raffleError.hint,
      },
    );

    throw new Error(
      "No se pudo cargar la rifa.",
    );
  }

  if (!raffle) {
    notFound();
  }

  if (
    raffle.status !== "draft" &&
    raffle.status !== "active"
  ) {
    redirect("/admin/raffles");
  }

  const initialValues: RaffleFormValues = {
    name: raffle.name,
    description: raffle.description ?? "",
    ticketPrice: String(raffle.ticket_price),
    totalTickets: String(raffle.total_tickets),
    startsAt: toDateTimeLocal(
      raffle.starts_at,
    ),
    closesAt: toDateTimeLocal(
      raffle.closes_at,
    ),
    drawAt: toDateTimeLocal(
      raffle.draw_at,
    ),
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/raffles"
          className="text-sm font-medium text-neutral-400 transition hover:text-white"
        >
          ← Volver a rifas
        </Link>

        <header className="mt-5">
          <p className="text-sm font-medium text-amber-400">
            Joyería Perla Dorada
          </p>

          <h1 className="mt-1 text-3xl font-semibold">
            Editar rifa
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Actualiza la configuración de{" "}
            <span className="font-medium text-neutral-200">
              {raffle.name}
            </span>
            .
          </p>
        </header>

        <div className="mt-8">
          <RaffleForm
            mode="edit"
            raffleId={raffle.id}
            initialValues={initialValues}
          />
        </div>
      </div>
    </main>
  );
}