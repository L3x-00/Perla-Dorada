import { brand } from "@/config/brand";

type WordmarkProps = {
  className?: string;
};

/*
 * Logotipo tipográfico provisional.
 *
 * Serif ligera en versalitas espaciadas, con un filo dorado debajo: es el
 * recurso clásico de joyería y aguanta perfectamente hasta que exista el
 * logo real. Para sustituirlo, coloca public/marca/logo/logo-horizontal.svg
 * y cambia este componente por una <Image>.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={`inline-flex flex-col items-start ${className ?? ""}`}>
      <span className="font-display text-xl font-light leading-none tracking-[0.18em] text-cream sm:text-2xl">
        {brand.shortName.toUpperCase()}
      </span>
      <span className="mt-1 h-px w-full bg-gradient-to-r from-gold-deep via-gold to-transparent" />
      <span className="eyebrow mt-1.5 text-[0.6rem] text-muted">
        {brand.tagline}
      </span>
    </span>
  );
}
