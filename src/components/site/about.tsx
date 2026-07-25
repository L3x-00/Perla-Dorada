import Image from "next/image";
import aboutBanner from "@/assets/site/about-banner.webp";
import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
} from "@/components/site/icons";
import { Reveal } from "@/components/site/reveal";
import { activeSocialLinks, brand } from "@/config/brand";

const SOCIAL_META = {
  instagram: { label: "Instagram", Icon: InstagramIcon },
  tiktok: { label: "TikTok", Icon: TiktokIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
} as const;

export function About() {
  const social = activeSocialLinks();

  return (
    <section id="nosotros" className="relative scroll-mt-24 overflow-hidden border-t border-line">
      {/*
        Imagen de fondo, importada como módulo (URL con hash de contenido:
        cada reemplazo cambia la URL, sin caché vieja bajo el mismo nombre).

        El logo "Perla Dorada" vive en la esquina superior izquierda de la
        imagen. Esta sección cambia de forma radicalmente según el ancho: en
        móvil (una columna, texto apilado) queda mucho más alta que ancha, y
        "cover" recorta en horizontal —ahí objectPosition-x es lo único que
        importa, se ve el 100% del alto—; en escritorio (lg:grid-cols-2) es
        mucho más ancha que alta, y "cover" recorta en vertical —ahí solo
        importa objectPosition-y, se ve el 100% del ancho—. Son ejes
        independientes que nunca compiten entre sí, así que un solo valor
        anclado a la esquina superior izquierda (0% 0%) mantiene el logo
        visible en cualquier tamaño de pantalla; verificado simulando el
        recorte real en móvil/tablet/escritorio.
      */}
      <div className="absolute inset-0 z-0">
        <Image
          src={aboutBanner}
          alt="Sobre nosotros - Perla Dorada"
          fill
          placeholder="blur"
          className="object-cover object-[0%_0%]"
          priority
          quality={100}
          sizes="100vw"
          style={{ opacity: 0.5 }}
        />
      </div>

      {/* Overlay oscuro para mejorar legibilidad */}
      <div 
        aria-hidden
        className="absolute inset-0 z-1 bg-black/40"
      />

      <div className="relative z-2 mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <div>
              <p className="eyebrow text-gold">Nosotros</p>
              <h2 className="mt-4 font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
                {brand.name}
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              <p className="text-base leading-relaxed text-muted">
                {brand.about}
              </p>

              {social.length > 0 ? (
                <div className="mt-10">
                  <p className="eyebrow text-muted">Síguenos</p>
                  <ul className="mt-5 flex flex-wrap gap-3">
                    {social.map(({ network, url }) => {
                      const { label, Icon } = SOCIAL_META[network];
                      return (
                        <li key={network}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-2.5 rounded-full border border-line px-5 py-2.5 text-sm text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}