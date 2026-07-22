import Link from "next/link";
import { redirect } from "next/navigation";

import { RaffleForm } from "../raffle-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewRafflePage() {
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
            Crear rifa
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            La nueva rifa se guardará como borrador hasta que
            decidas activarla.
          </p>
        </header>

        <div className="mt-8">
          <RaffleForm mode="create" />
        </div>
      </div>
    </main>
  );
}