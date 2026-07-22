import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold">
          Joyería Perla Dorada
        </h1>

        <p className="mt-4 text-neutral-400">
          Participa en nuestra rifa vigente.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/seguimiento"
            className="inline-flex rounded-lg border border-amber-500 px-4 py-3 font-semibold text-amber-400"
          >
            Consultar mi solicitud
          </Link>
        </div>
      </section>
    </main>
  );
}