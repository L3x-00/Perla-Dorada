import Link from "next/link";
import type { ReactNode } from "react";

import { brand } from "@/config/brand";

/*
 * Un abogado revisó y aprobó las bases del sorteo, la política de
 * privacidad y la de devoluciones (04 ago 2026); términos y condiciones es
 * texto genérico de uso del sitio, sin contenido propio del sorteo.
 */
export const LEGAL_ES_BORRADOR = false;

type LegalDocumentProps = {
  title: string;
  updatedAt: string;
  intro?: string;
  children: ReactNode;
};

export function LegalDocument({
  title,
  updatedAt,
  intro,
  children,
}: LegalDocumentProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link
        href="/"
        className="eyebrow text-muted transition-colors hover:text-gold"
      >
        ← Volver al inicio
      </Link>

      <h1 className="mt-8 font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
        {title}
      </h1>

      <p className="mt-4 text-sm text-muted">Última actualización: {updatedAt}</p>

      {LEGAL_ES_BORRADOR ? (
        <div className="mt-8 rounded-xl border border-gold-deep/60 bg-ink-2 p-5">
          <p className="eyebrow text-gold">Documento en revisión</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Este texto es un borrador pendiente de revisión legal. Para
            cualquier consulta vinculante, escríbenos antes de participar.
          </p>
        </div>
      ) : null}

      {intro ? (
        <p className="mt-8 text-base leading-relaxed text-muted">{intro}</p>
      ) : null}

      <div className="mt-10 space-y-9">{children}</div>

      <div className="mt-14 hairline" />

      <p className="mt-6 text-sm text-muted">
        {brand.legal.businessName || brand.name}
        {brand.legal.ruc ? ` · RUC ${brand.legal.ruc}` : ""}
        {brand.contact.email ? ` · ${brand.contact.email}` : ""}
      </p>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-light text-cream">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed">
          <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-gold-deep" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
