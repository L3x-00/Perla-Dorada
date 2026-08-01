type PromoIndicatorsProps = {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
};

/** Puntos de paginación del carrusel. No se muestra si solo hay un slide. */
export function PromoIndicators({
  count,
  activeIndex,
  onSelect,
}: PromoIndicatorsProps) {
  if (count <= 1) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Promociones"
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;

        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Ir a la promoción ${index + 1} de ${count}`}
            onClick={() => onSelect(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? "w-6 bg-gold" : "w-1.5 bg-line hover:bg-gold/50"
            }`}
          />
        );
      })}
    </div>
  );
}
