import Link from "next/link";

import {
  FacebookIcon,
  InstagramIcon,
  MailIcon,
  MapPinIcon,
  TiktokIcon,
  WhatsappIcon,
} from "@/components/site/icons";
import { BrandLogo } from "@/components/site/brand-logo";
import { activeSocialLinks, brand, whatsappLink } from "@/config/brand";

const SOCIAL_META = {
  instagram: { label: "Instagram", Icon: InstagramIcon },
  tiktok: { label: "TikTok", Icon: TiktokIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
} as const;

const LEGAL_LINKS = [
  { label: "Términos y condiciones", href: "/legal/terminos" },
  { label: "Bases del sorteo", href: "/legal/bases" },
  { label: "Política de privacidad", href: "/legal/privacidad" },
  { label: "Política de devoluciones", href: "/legal/devoluciones" },
];

export function SiteFooter() {
  const social = activeSocialLinks();
  const whatsapp = whatsappLink(
    `Hola, quiero información sobre ${brand.name}.`,
  );
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-ink-2">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandLogo className="h-auto w-32" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              {brand.description}
            </p>

            {social.length > 0 ? (
              <ul className="mt-6 flex items-center gap-3">
                {social.map(({ network, url }) => {
                  const { label, Icon } = SOCIAL_META[network];
                  return (
                    <li key={network}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition-colors duration-300 hover:border-gold hover:text-gold"
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div>
            <h2 className="eyebrow text-gold">Contacto</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted">
              {whatsapp ? (
                <li>
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 transition-colors hover:text-cream"
                  >
                    <WhatsappIcon className="h-4 w-4" />
                    WhatsApp
                  </a>
                </li>
              ) : null}

              {brand.contact.email ? (
                <li>
                  <a
                    href={`mailto:${brand.contact.email}`}
                    className="inline-flex items-center gap-2 transition-colors hover:text-cream"
                  >
                    <MailIcon className="h-4 w-4" />
                    {brand.contact.email}
                  </a>
                </li>
              ) : null}

              {brand.contact.address || brand.contact.city ? (
                <li className="inline-flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {[brand.contact.address, brand.contact.city]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow text-gold">Legal</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/seguimiento"
                  className="transition-colors hover:text-cream"
                >
                  Consultar mi solicitud
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 hairline" />

        <div className="mt-6 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.legal.businessName || brand.name}
            {brand.legal.ruc ? ` · RUC ${brand.legal.ruc}` : ""}
          </p>
          <p>Los sorteos se realizan de forma manual y supervisada.</p>
        </div>
      </div>
    </footer>
  );
}
