import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  RaffleForm,
  type RaffleFormValues,
} from "../../raffle-form";
import { RaffleImageUpload } from "../../raffle-image-upload";
import { isoToLimaInput } from "@/lib/datetime-lima";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EditRafflePageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

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
        draw_at,
        image_path
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
    startsAt: isoToLimaInput(raffle.starts_at),
    closesAt: isoToLimaInput(raffle.closes_at),
    drawAt: isoToLimaInput(raffle.draw_at),
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/raffles"
          className="text-sm text-muted transition-colors hover:text-gold"
        >
          ← Volver a rifas
        </Link>

        <header className="mt-5">
          <p className="eyebrow text-gold">
            Joyería Perla Dorada
          </p>

          <h1 className="mt-2 font-display text-3xl font-light text-cream sm:text-4xl">
            Editar rifa
          </h1>

          <p className="mt-2.5 text-sm text-muted">
            Actualiza la configuración de{" "}
            <span className="text-cream">
              {raffle.name}
            </span>
            .
          </p>
        </header>

        <div className="mt-8">
          <RaffleImageUpload
            raffleId={raffle.id}
            currentPath={raffle.image_path}
          />
        </div>

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