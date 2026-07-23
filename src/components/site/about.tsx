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
    <section id="nosotros" className="scroll-mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
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
