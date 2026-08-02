import type { ReactNode } from "react";

/*
 * Kit de interfaz del panel.
 *
 * Comparte la paleta y la tipografía del sitio público, pero con densidad
 * de herramienta: menos aire, controles más compactos y nada de
 * animaciones lentas. Aquí prima leer y actuar rápido.
 *
 * Son constantes de clases (no componentes) para poder combinarlas sin
 * envolver cada elemento.
 */

export const adminCard = "rounded-xl border border-line bg-ink-2";

export const adminInput =
  "w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-cream outline-none transition-colors duration-200 placeholder:text-muted/50 focus:border-gold disabled:opacity-50 [&:user-valid]:border-emerald-500 [&:user-valid]:bg-emerald-950/15 [&:user-valid]:focus:border-emerald-400";

export const adminLabel =
  "mb-2 block text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-cream transition-colors duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-200 transition-colors duration-200 hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSuccess =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-800/70 bg-emerald-950/30 px-4 py-2.5 text-sm font-medium text-emerald-200 transition-colors duration-200 hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSmall = "px-3 py-2 text-xs";

/** Contenedor estándar de página del panel. */
export function AdminPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
        {children}
      </div>
    </main>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow text-gold">{eyebrow}</p> : null}

        <h1 className="mt-2 font-display text-3xl font-light text-cream sm:text-4xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/*
 * Los estados conservan color semántico a propósito: aquí el color es
 * información que se escanea de un vistazo, no decoración de marca.
 */
const BADGE_TONES = {
  pending: "border-amber-800/70 bg-amber-950/40 text-amber-300",
  approved: "border-emerald-800/70 bg-emerald-950/40 text-emerald-300",
  rejected: "border-red-800/70 bg-red-950/40 text-red-300",
  expired: "border-line bg-ink-3 text-muted",
  neutral: "border-line bg-ink-3 text-muted",
  gold: "border-gold-deep/70 bg-gold-deep/15 text-gold-soft",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function AdminAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: ReactNode;
}) {
  const tones = {
    error: "border-red-900/70 bg-red-950/30 text-red-200",
    info: "border-line bg-ink-2 text-muted",
    success: "border-emerald-800/70 bg-emerald-950/30 text-emerald-200",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border p-4 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <h2 className="font-display text-2xl font-light text-cream">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
