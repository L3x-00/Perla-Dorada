import Link from "next/link";
import { RaffleForm } from "../raffle-form";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";

export default async function NewRafflePage() {
  await requireActiveAdminPage();

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
            Crear rifa
          </h1>

          <p className="mt-2.5 text-sm text-muted">
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
