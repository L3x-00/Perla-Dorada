import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PromotionForm, type PromotionFormValues } from "../../promotion-form";
import { isoToLimaInput } from "@/lib/datetime-lima";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EditPromotionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPromotionPage({
  params,
}: EditPromotionPageProps) {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  if (claimsError || typeof claimsData?.claims?.sub !== "string") {
    redirect("/admin/login");
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const adminClient = createAdminClient();

  const [{ data: promotion, error: promotionError }, { data: raffles }] =
    await Promise.all([
      adminClient
        .from("promotions")
        .select(
          "id, title, description, image_path, cta_kind, cta_raffle_id, cta_url, cta_text, starts_at, ends_at, enabled",
        )
        .eq("id", id)
        .maybeSingle(),
      adminClient
        .from("raffles")
        .select("id, name, status")
        .order("created_at", { ascending: false }),
    ]);

  if (promotionError) {
    console.error("Error cargando promoción para editar:", promotionError);
    throw new Error("No se pudo cargar la promoción.");
  }

  if (!promotion) {
    notFound();
  }

  const initialValues: PromotionFormValues = {
    title: promotion.title,
    description: promotion.description,
    imagePath: promotion.image_path,
    ctaKind: promotion.cta_kind,
    ctaRaffleId: promotion.cta_raffle_id ?? "",
    ctaUrl: promotion.cta_url ?? "",
    ctaText: promotion.cta_text,
    startsAt: isoToLimaInput(promotion.starts_at),
    endsAt: isoToLimaInput(promotion.ends_at),
    enabled: promotion.enabled,
  };

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
            Editar promoción
          </h1>
          <p className="mt-2.5 text-sm text-muted">
            Actualiza{" "}
            <span className="text-cream">{promotion.title}</span>.
          </p>
        </header>

        <div className="mt-8">
          <PromotionForm
            mode="edit"
            promotionId={promotion.id}
            initialValues={initialValues}
            raffles={raffles ?? []}
          />
        </div>
      </div>
    </main>
  );
}
