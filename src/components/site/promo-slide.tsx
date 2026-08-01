import Link from "next/link";

import type { PublicPromotion } from "@/lib/promotions/public-promotions";

type PromoSlideProps = {
  promo: PublicPromotion;
  /** El primer slide visible no debe esperar lazy-loading. */
  eager?: boolean;
};

function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

/*
 * Imagen (o fondo degradado si la promoción no tiene foto) con el título,
 * descripción y CTA superpuestos abajo con un gradiente — el texto real
 * nunca va horneado en la imagen, así que funciona igual con o sin foto.
 */
export function PromoSlide({ promo, eager = false }: PromoSlideProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-ink-3 via-ink-2 to-ink">
      {promo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen remota de Supabase Storage: next.config no tiene remotePatterns configurados.
        <img
          src={promo.imageUrl}
          alt=""
          loading={eager ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h3 className="font-display text-xl font-light leading-tight text-cream sm:text-2xl">
          {promo.title}
        </h3>

        {promo.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/80">
            {promo.description}
          </p>
        ) : null}

        <PromoCta ctaText={promo.ctaText} ctaHref={promo.ctaHref} />
      </div>
    </div>
  );
}

function PromoCta({ ctaText, ctaHref }: { ctaText: string; ctaHref: string }) {
  const className =
    "mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft";

  if (isInternalHref(ctaHref)) {
    return (
      <Link href={ctaHref} className={className}>
        {ctaText}
      </Link>
    );
  }

  return (
    <a href={ctaHref} target="_blank" rel="noopener noreferrer" className={className}>
      {ctaText}
    </a>
  );
}
