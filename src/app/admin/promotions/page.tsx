import Link from "next/link";
import { PromotionActions } from "./promotion-actions";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
  btnPrimary,
} from "@/components/admin/ui";
import { promotionImageUrl } from "@/lib/storage/public-url";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";

function formatDate(value: string | null): string {
  if (!value) {
    return "Sin límite";
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

export default async function PromotionsPage() {
  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: promotions, error: promotionsError } = await adminClient
    .from("promotions")
    .select(
      `
        id,
        title,
        description,
        image_path,
        cta_kind,
        cta_text,
        cta_url,
        starts_at,
        ends_at,
        enabled,
        raffle:cta_raffle_id ( name )
      `,
    )
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (promotionsError) {
    console.error("Error cargando promociones:", promotionsError);
  }

  const promotionList = promotions ?? [];

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Promociones"
        description="Controla el carrusel del modal de bienvenida que ve el público al entrar a la portada."
        action={
          <Link href="/admin/promotions/new" className={btnPrimary}>
            Nueva promoción
          </Link>
        }
      />

      {promotionsError ? (
        <div className="mt-8">
          <AdminAlert>No se pudieron cargar las promociones.</AdminAlert>
        </div>
      ) : null}

      {!promotionsError && promotionList.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No hay promociones"
            description="Crea la primera para que aparezca en el modal de bienvenida del sitio."
            action={
              <Link href="/admin/promotions/new" className={btnPrimary}>
                Crear primera promoción
              </Link>
            }
          />
        </div>
      ) : null}

      {promotionList.length > 0 ? (
        <div className="mt-8 grid gap-4">
          {promotionList.map((promotion) => {
            const imageUrl = promotionImageUrl(promotion.image_path);
            const ctaLabel =
              promotion.cta_kind === "raffle"
                ? `Sorteo: ${promotion.raffle?.name ?? "sorteo eliminado"}`
                : `Enlace: ${promotion.cta_url}`;

            return (
              <article
                key={promotion.id}
                className="rounded-xl border border-line bg-ink-2 p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-16 w-28 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-center text-[0.6rem] uppercase tracking-widest text-muted">
                        Sin foto
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-xl font-light text-cream">
                          {promotion.title}
                        </h2>
                        <Badge tone={promotion.enabled ? "approved" : "neutral"}>
                          {promotion.enabled ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>

                      {promotion.description ? (
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                          {promotion.description}
                        </p>
                      ) : null}

                      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                        <Field label="Botón" value={`"${promotion.cta_text}" → ${ctaLabel}`} />
                        <Field label="Desde" value={formatDate(promotion.starts_at)} />
                        <Field label="Hasta" value={formatDate(promotion.ends_at)} />
                      </dl>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <PromotionActions
                      promotionId={promotion.id}
                      title={promotion.title}
                      enabled={promotion.enabled}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </AdminPage>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-sm text-cream">{value}</dd>
    </div>
  );
}
