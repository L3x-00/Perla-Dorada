/*
 * Clases compartidas por los formularios públicos (compra, seguimiento y
 * descarga de tickets). Estaban duplicadas literalmente en los tres.
 */

export const siteInputClass =
  "w-full rounded-lg border border-line bg-ink px-4 py-3.5 text-cream outline-none transition-colors duration-300 placeholder:text-muted/60 focus:border-gold [&:user-valid]:border-emerald-500 [&:user-valid]:bg-emerald-950/15 [&:user-valid]:focus:border-emerald-400";

export const siteLabelClass = "eyebrow mb-2.5 block text-muted";

export const siteButtonClass =
  "w-full rounded-full bg-gold px-7 py-4 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50";
