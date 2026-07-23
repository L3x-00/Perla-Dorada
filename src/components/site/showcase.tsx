import { Reveal } from "@/components/site/reveal";
import { vitrina, vitrinaImageSrc } from "@/config/vitrina";

/*
 * Vitrina de piezas.
 *
 * Si aún no hay fotos configuradas, la sección no se renderiza: es
 * preferible un sitio más corto que uno con huecos evidentes.
 */
export function Showcase() {
  if (vitrina.length === 0) {
    return null;
  }

  return (
    <section id="coleccion" className="scroll-mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <p className="eyebrow text-gold">Colección</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight text-cream sm:text-5xl">
            Piezas seleccionadas una por una
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Trabajamos con oro y plata de calidad certificada. Cada pieza pasa
            por nuestras manos antes de llegar a las tuyas.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {vitrina.map((piece, index) => (
            <Reveal key={piece.file} delay={(index % 3) * 0.08}>
              <li className="group list-none overflow-hidden rounded-xl border border-line bg-ink-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vitrinaImageSrc(piece)}
                  alt={piece.alt}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
