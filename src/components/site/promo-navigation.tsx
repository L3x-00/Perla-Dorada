import { ChevronLeftIcon, ChevronRightIcon } from "@/components/site/icons";

type PromoNavigationProps = {
  onPrev: () => void;
  onNext: () => void;
};

/** Flechas anterior/siguiente superpuestas sobre el slide. */
export function PromoNavigation({ onPrev, onNext }: PromoNavigationProps) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Promoción anterior"
        className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white transition-colors duration-300 hover:border-gold hover:text-gold"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label="Siguiente promoción"
        className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white transition-colors duration-300 hover:border-gold hover:text-gold"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </>
  );
}
