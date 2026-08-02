"use client";

import { adminLabel } from "@/components/admin/ui";
import { MAX_PRIZES, type RafflePrize } from "@/lib/raffles/prizes";

import { StagedImageInput } from "./staged-image-input";

type PrizeFieldsProps = {
  prizes: RafflePrize[];
  onChange: (prizes: RafflePrize[]) => void;
  disabled?: boolean;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-line bg-ink px-3 text-sm text-cream outline-none transition placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60";

/*
 * Lista editable de premios de la rifa. Cada fila: nombre, cantidad y una foto
 * opcional. Es contenido descriptivo ("una moto", "2 x dinero en efectivo",
 * "un televisor"); no cambia la lógica de ganador único. El límite y el
 * formato reales los impone la base (normalize_raffle_prizes).
 */
export function PrizeFields({
  prizes,
  onChange,
  disabled = false,
}: PrizeFieldsProps) {
  function patch(index: number, next: Partial<RafflePrize>) {
    onChange(
      prizes.map((prize, i) => (i === index ? { ...prize, ...next } : prize)),
    );
  }

  function add() {
    if (prizes.length >= MAX_PRIZES) {
      return;
    }
    onChange([...prizes, { id: null, title: "", quantity: 1, imagePath: null }]);
  }

  function remove(index: number) {
    onChange(prizes.filter((_, i) => i !== index));
  }

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-xl font-light text-cream">
          Premios del sorteo
        </h2>
        <p className="mt-1 text-sm text-muted">
          Agrega cada premio con su cantidad y, si quieres, una foto. Ejemplos:
          «Una moto», «2 · Dinero en efectivo», «Un televisor Samsung».
        </p>
      </div>

      {prizes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Todavía no agregaste premios. La rifa puede publicarse igual, pero la
          lista de premios luce mejor.
        </p>
      ) : (
        <ul className="grid gap-3">
          {prizes.map((prize, index) => (
            <li
              key={index}
              className="grid gap-4 rounded-lg border border-line bg-ink p-4 sm:grid-cols-[1fr_auto]"
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <div className="grid gap-1.5">
                  <label
                    htmlFor={`prize-title-${index}`}
                    className={adminLabel}
                  >
                    Premio {index + 1}
                  </label>
                  <input
                    id={`prize-title-${index}`}
                    type="text"
                    value={prize.title}
                    maxLength={120}
                    disabled={disabled}
                    placeholder="Ej.: Una moto lineal"
                    className={fieldClass}
                    onChange={(event) =>
                      patch(index, { title: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor={`prize-qty-${index}`}
                    className={adminLabel}
                  >
                    Cantidad
                  </label>
                  <input
                    id={`prize-qty-${index}`}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={prize.quantity}
                    disabled={disabled}
                    className={fieldClass}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      patch(index, {
                        quantity:
                          Number.isFinite(value) && value >= 1
                            ? Math.floor(value)
                            : 1,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-start justify-between gap-3 sm:items-end">
                <StagedImageInput
                  path={prize.imagePath}
                  disabled={disabled}
                  addLabel="Foto"
                  onChange={(path) => patch(index, { imagePath: path })}
                />

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="text-xs text-muted transition-colors hover:text-red-300 disabled:opacity-50"
                >
                  Eliminar premio
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          disabled={disabled || prizes.length >= MAX_PRIZES}
          onClick={add}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-cream transition-colors duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Agregar premio
        </button>
        {prizes.length >= MAX_PRIZES ? (
          <p className="mt-2 text-xs text-muted">
            Llegaste al máximo de {MAX_PRIZES} premios.
          </p>
        ) : null}
      </div>
    </section>
  );
}
