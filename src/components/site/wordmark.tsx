import Image from "next/image";

import { brand } from "@/config/brand";

type WordmarkProps = {
  className?: string;
  /** Usa texto claro cuando la marca se superpone a una fotografía oscura. */
  inverted?: boolean;
  /** Versión reducida para la barra de navegación: logo chico, sin tagline. */
  compact?: boolean;
};

/*
 * Logotipo tipográfico provisional.
 *
 * Serif ligera en versalitas espaciadas, con un filo dorado debajo: es el
 * recurso clásico de joyería y aguanta perfectamente hasta que exista el
 * logo real. Para sustituirlo, coloca public/marca/logo/logo-horizontal.svg
 * y cambia este componente por una <Image>.
 */
export function Wordmark({
  className,
  inverted = false,
  compact = false,
}: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src="/marca/logo/logo.webp"
        alt=""
        width={1280}
        height={1280}
        className={`shrink-0 object-contain drop-shadow-[0_0_10px_rgba(201,162,39,0.3)] ${
          compact ? "h-9 w-9" : "h-14 w-14 sm:h-16 sm:w-16"
        }`}
      />
      <span className="inline-flex flex-col items-start">
        <span
          className={`font-display font-light leading-none tracking-[0.18em] ${
            compact ? "text-base" : "text-xl sm:text-2xl"
          } ${inverted ? "text-white" : "text-cream"}`}
        >
          {brand.shortName.toUpperCase()}
        </span>
        {compact ? null : (
          <>
            <span className="mt-1 h-px w-full bg-gradient-to-r from-gold-deep via-gold to-transparent" />
            <span
              className={`eyebrow mt-1.5 text-[0.6rem] ${
                inverted ? "text-white/70" : "text-muted"
              }`}
            >
              {brand.tagline}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
