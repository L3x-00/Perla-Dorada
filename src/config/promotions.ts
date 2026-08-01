import { whatsappLink } from "@/config/brand";

/*
 * Promociones del modal de bienvenida (carrusel).
 *
 * ⚠️ COMPLETAR: estos 4 ejemplos traen fechas de referencia para que el
 * filtrado automático por vigencia sea visible desde ya; reemplázalas por
 * las campañas reales cuando existan. Si `image` es null, el slide usa un
 * fondo degradado propio (ver public/marca/promo/README dentro de
 * public/marca/README.md) — no hace falta tener foto para publicar una
 * promoción de texto.
 *
 * `enabled: false` la apaga sin borrarla (útil para dejarla lista y
 * activarla el día que empieza la campaña).
 */

export type PromoLayout = "default" | "compact";

export type Promotion = {
  id: string;
  title: string;
  description: string;
  /** Nombre de archivo dentro de public/marca/promo/, o null para el fondo por defecto. */
  image: string | null;
  ctaText: string;
  ctaUrl: string;
  /** ISO 8601. null = sin límite en ese extremo. */
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  layout?: PromoLayout;
};

const contactCta =
  whatsappLink("Hola, quiero más información sobre la promoción.") ??
  "/#nosotros";

export const promotions: Promotion[] = [
  {
    id: "sorteo-2x1",
    title: "¡Sorteo especial! 2×1 en boletos",
    description:
      "Todo el mes: cada boleto que compras te da uno adicional en el mismo sorteo.",
    image: "promo-gold-diamond.svg",
    ctaText: "Ver sorteo",
    ctaUrl: "/#sorteo",
    startsAt: "2026-08-01T00:00:00-05:00",
    endsAt: "2026-08-31T23:59:59-05:00",
    enabled: true,
  },
  {
    id: "descuento-joyeria",
    title: "20% en compras mayores a S/100",
    description:
      "Válido del 10 al 17 de agosto en piezas seleccionadas. Coordinamos por WhatsApp.",
    image: "promo-spotlight.svg",
    ctaText: "Escríbenos",
    ctaUrl: contactCta,
    startsAt: "2026-08-10T00:00:00-05:00",
    endsAt: "2026-08-17T23:59:59-05:00",
    enabled: true,
  },
  {
    id: "boleto-extra",
    title: "Participa y gana un boleto extra",
    description:
      "Comparte tu código de seguimiento en redes y etiquétanos para sumar un boleto más.",
    image: "promo-stars.svg",
    ctaText: "Cómo participar",
    ctaUrl: "/#sorteo",
    startsAt: null,
    endsAt: null,
    enabled: true,
    layout: "compact",
  },
  {
    id: "lanzamiento",
    title: "Promoción de lanzamiento",
    description: "Oferta única por tiempo limitado en nuestra nueva colección.",
    image: "promo-gem.svg",
    ctaText: "Quiero saber más",
    ctaUrl: contactCta,
    startsAt: "2026-08-01T00:00:00-05:00",
    endsAt: "2026-08-15T23:59:59-05:00",
    enabled: true,
  },
];

function isPromotionActive(promotion: Promotion, referenceDate: Date): boolean {
  if (!promotion.enabled) {
    return false;
  }

  const time = referenceDate.getTime();

  if (promotion.startsAt && time < new Date(promotion.startsAt).getTime()) {
    return false;
  }

  if (promotion.endsAt && time > new Date(promotion.endsAt).getTime()) {
    return false;
  }

  return true;
}

/** Promociones vigentes a la fecha indicada (por defecto, ahora mismo). */
export function getActivePromotions(referenceDate: Date = new Date()): Promotion[] {
  return promotions.filter((promotion) => isPromotionActive(promotion, referenceDate));
}

export function promotionImageSrc(promotion: Promotion): string | null {
  return promotion.image ? `/marca/promo/${promotion.image}` : null;
}
