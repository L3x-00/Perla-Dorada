import Image from "next/image";

import { brand } from "@/config/brand";

type WordmarkProps = {
  className?: string;
  /** Usa texto claro cuando la marca se superpone a una fotografía oscura. */
  inverted?: boolean;
};

/*
 * Logotipo tipográfico provisional.
 *
 * Serif ligera en versalitas espaciadas, con un filo dorado debajo: es el
 * recurso clásico de joyería y aguanta perfectamente hasta que exista el
 * logo real. Para sustituirlo, coloca public/marca/logo/logo-horizontal.svg
 * y cambia este componente por una <Image>.
 */
export function Wordmark({ className, inverted = false }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/20 p-1.5 shadow-[0_0_18px_rgba(201,162,39,0.28)]">
        <Image
          src="/marca/logo/logo.webp"
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-contain"
        />
      </span>
      <span className="inline-flex flex-col items-start">
        <span
          className={`font-display text-xl font-light leading-none tracking-[0.18em] sm:text-2xl ${
            inverted ? "text-white" : "text-cream"
          }`}
        >
          {brand.shortName.toUpperCase()}
        </span>
        <span className="mt-1 h-px w-full bg-gradient-to-r from-gold-deep via-gold to-transparent" />
        <span
          className={`eyebrow mt-1.5 text-[0.6rem] ${
            inverted ? "text-white/70" : "text-muted"
          }`}
        >
          {brand.tagline}
        </span>
      </span>
    </span>
  );
}
