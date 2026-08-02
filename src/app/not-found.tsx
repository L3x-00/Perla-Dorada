import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
      <section className="max-w-lg rounded-2xl border border-line bg-ink-2 p-8 text-center shadow-2xl shadow-black/20">
        <p className="eyebrow text-gold">Joyería Perla Dorada</p>
        <h1 className="mt-3 font-display text-4xl font-light">Página no encontrada</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          El enlace puede haber cambiado o ya no estar disponible.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-full bg-gold px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-gold-soft"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
