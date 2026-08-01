import "server-only";

import { promotionImageUrl } from "@/lib/storage/public-url";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicPromotion = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  ctaText: string;
  ctaHref: string;
};

/*
 * Promociones vigentes para el modal de bienvenida público.
 *
 * El filtrado por fecha se hace en la aplicación (no en la consulta) porque
 * es una tabla pequeña de contenido de marketing: más simple y sin riesgo de
 * errores de escape al construir un filtro OR de PostgREST a mano.
 *
 * cta_kind = 'raffle' siempre resuelve a "/#sorteo": el sitio solo muestra
 * una rifa activa a la vez, así que no existe una página propia por rifa a
 * la que enlazar. Qué sorteo eligió el admin es solo bookkeeping del panel.
 */
export async function getActivePublicPromotions(): Promise<PublicPromotion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, title, description, image_path, cta_kind, cta_url, cta_text, starts_at, ends_at, enabled",
    )
    .eq("enabled", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando promociones:", error);
    return [];
  }

  const now = Date.now();

  return (data ?? [])
    .filter((row) => {
      if (row.starts_at && new Date(row.starts_at).getTime() > now) {
        return false;
      }

      if (row.ends_at && new Date(row.ends_at).getTime() < now) {
        return false;
      }

      return true;
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: promotionImageUrl(row.image_path),
      ctaText: row.cta_text,
      ctaHref: row.cta_kind === "raffle" ? "/#sorteo" : (row.cta_url ?? "/#sorteo"),
    }));
}
