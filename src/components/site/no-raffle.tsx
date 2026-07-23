import Link from "next/link";

import {
  FacebookIcon,
  InstagramIcon,
  TiktokIcon,
  WhatsappIcon,
} from "@/components/site/icons";
import { Reveal } from "@/components/site/reveal";
import { activeSocialLinks, whatsappLink } from "@/config/brand";

const SOCIAL_META = {
  instagram: { label: "Instagram", Icon: InstagramIcon },
  tiktok: { label: "TikTok", Icon: TiktokIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
} as const;

type NoRaffleProps = {
  /** Mensaje alternativo cuando el portal está en mantenimiento. */
  notice?: { title: string; message: string };
};

/*
 * Estado sin sorteo vigente.
 *
 * Es el estado NORMAL la mayor parte del año (se hacen 3-4 sorteos), así
 * que no puede ser un callejón sin salida: convierte la visita en un
 * seguidor para que se entere del próximo.
 */
export function NoRaffle({ notice }: NoRaffleProps) {
  const social = activeSocialLinks();
  const whatsapp = whatsappLink(
    "Hola, quiero enterarme del próximo sorteo.",
  );

  return (
    <section id="sorteo" className="scroll-mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-gold">
              {notice ? "Aviso" : "Próximo sorteo"}
            </p>

            <h2 className="mt-5 font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
              {notice ? notice.title : "Aún no hay un sorteo abierto"}
            </h2>

            <p className="mt-6 text-base leading-relaxed text-muted">
              {notice
                ? notice.message
                : "Realizamos sorteos varias veces al año. Síguenos para ser de los primeros en enterarte cuando abra el siguiente."}
            </p>

            {!notice && (social.length > 0 || whatsapp) ? (
              <ul className="mt-10 flex flex-wrap justify-center gap-3">
                {social.map(({ network, url }) => {
                  const { label, Icon } = SOCIAL_META[network];
                  return (
                    <li key={network}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 rounded-full border border-line px-6 py-3 text-sm text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </a>
                    </li>
                  );
                })}

                {whatsapp ? (
                  <li>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
                    >
                      <WhatsappIcon className="h-4 w-4" />
                      Avísame del próximo
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}

            <p className="mt-10 text-sm text-muted">
              ¿Participaste en un sorteo anterior?{" "}
              <Link
                href="/seguimiento"
                className="text-gold underline-offset-4 transition hover:underline"
              >
                Consulta tu solicitud
              </Link>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
