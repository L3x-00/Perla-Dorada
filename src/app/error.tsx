"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
      <section className="max-w-lg rounded-2xl border border-line bg-ink-2 p-8 text-center shadow-2xl shadow-black/20">
        <p className="eyebrow text-gold">Joyería Perla Dorada</p>
        <h1 className="mt-3 font-display text-3xl font-light">
          No pudimos cargar esta página
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No se realizó ningún cambio. Inténtalo otra vez o vuelve al inicio.
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-full border border-line px-5 py-3 text-sm text-cream transition-colors hover:border-gold hover:text-gold"
          >
            Ir al inicio
          </Link>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-gold px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-gold-soft"
          >
            Reintentar
          </button>
        </div>
      </section>
    </main>
  );
}
