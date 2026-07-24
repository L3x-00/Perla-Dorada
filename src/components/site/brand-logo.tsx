import { brand } from "@/config/brand";

type BrandLogoProps = {
  className?: string;
};

/*
 * Logotipo real de la joyería: emblema de concha con perla + "Perla Dorada /
 * JOYERÍA", en oro sobre transparente (WEBP con canal alfa), así que asienta
 * bien sobre el fondo oscuro. Es un lockup cuadrado y completo; se usa donde
 * hay espacio para lucirlo (login, pie). En barras estrechas se prefiere el
 * Wordmark tipográfico.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/marca/logo/logo.webp"
      alt={brand.name}
      width={1280}
      height={1280}
      className={className ?? "h-auto w-40"}
    />
  );
}
