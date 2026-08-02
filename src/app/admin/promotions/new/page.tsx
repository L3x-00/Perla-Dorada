import Link from "next/link";
import { PromotionForm } from "../promotion-form";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NewPromotionPage() {
  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: raffles } = await adminClient
    .from("raffles")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/promotions"
          className="text-sm text-muted transition-colors hover:text-gold"
        >
          ← Volver a promociones
        </Link>

        <header className="mt-5">
          <p className="eyebrow text-gold">Joyería Perla Dorada</p>
          <h1 className="mt-2 font-display text-3xl font-light text-cream sm:text-4xl">
            Nueva promoción
          </h1>
          <p className="mt-2.5 text-sm text-muted">
            Aparecerá en el carrusel del modal de bienvenida mientras esté
            activa y dentro de su rango de fechas.
          </p>
        </header>

        <div className="mt-8">
          <PromotionForm mode="create" raffles={raffles ?? []} />
        </div>
      </div>
    </main>
  );
}
