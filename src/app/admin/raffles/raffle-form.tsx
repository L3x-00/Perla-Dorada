"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  adminInput,
  adminLabel,
  btnGhost,
  btnPrimary,
} from "@/components/admin/ui";
import {
  type FormEvent,
  useState,
} from "react";

import { limaInputToIso } from "@/lib/datetime-lima";
import { type RafflePrize } from "@/lib/raffles/prizes";

import { PrizeFields } from "./prize-fields";
import { StagedImageInput } from "./staged-image-input";

export type RaffleFormValues = {
  name: string;
  description: string;
  ticketPrice: string;
  totalTickets: string;
  startsAt: string;
  closesAt: string;
  drawAt: string;
};

type RaffleFormProps =
  | {
      mode: "create";
      raffleId?: never;
      initialValues?: Partial<RaffleFormValues>;
      initialPrizes?: RafflePrize[];
    }
  | {
      mode: "edit";
      raffleId: string;
      initialValues: RaffleFormValues;
      initialPrizes?: RafflePrize[];
    };

type ApiResponse = {
  success?: boolean;
  raffle?: {
    id: string;
  };
  error?: string;
};

const emptyValues: RaffleFormValues = {
  name: "",
  description: "",
  ticketPrice: "",
  totalTickets: "",
  startsAt: "",
  closesAt: "",
  drawAt: "",
};

const inputClassName =
  "h-11 rounded-lg border border-line bg-ink px-3 text-sm text-cream outline-none transition placeholder:text-muted focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60";

function getInitialValues(
  values?: Partial<RaffleFormValues>,
): RaffleFormValues {
  return {
    ...emptyValues,
    ...values,
  };
}

/*
 * El valor del input se interpreta SIEMPRE como hora de Lima, no como la
 * zona del dispositivo. Así la fecha que se guarda coincide con la que se
 * relee al editar, corra el servidor donde corra.
 */
function toApiDate(
  value: string,
): string | null {
  return limaInputToIso(value);
}

export function RaffleForm(
  props: RaffleFormProps,
) {
  const router = useRouter();

  const [values, setValues] =
    useState<RaffleFormValues>(() =>
      getInitialValues(props.initialValues),
    );

  const [prizes, setPrizes] = useState<RafflePrize[]>(
    () => props.initialPrizes ?? [],
  );

  /*
   * Foto del premio mayor. En "crear" se sube en staging aquí mismo; en
   * "editar" la gestiona RaffleImageUpload en la página, así que este control
   * no aparece en ese modo.
   */
  const [heroImagePath, setHeroImagePath] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  function updateField(
    field: keyof RaffleFormValues,
    value: string,
  ): void {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setErrorMessage(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);

    const name = values.name.trim();
    const description =
      values.description.trim();

    const ticketPrice =
      Number(values.ticketPrice);

    const totalTickets =
      Number(values.totalTickets);

    if (name.length < 3) {
      setErrorMessage(
        "El nombre debe tener al menos 3 caracteres.",
      );
      return;
    }

    if (
      !Number.isFinite(ticketPrice) ||
      ticketPrice <= 0
    ) {
      setErrorMessage(
        "El precio del ticket debe ser mayor que cero.",
      );
      return;
    }

    if (
      !Number.isSafeInteger(totalTickets) ||
      totalTickets <= 0
    ) {
      setErrorMessage(
        "El total de tickets debe ser un número entero mayor que cero.",
      );
      return;
    }

    const startsAt =
      toApiDate(values.startsAt);

    const closesAt =
      toApiDate(values.closesAt);

    const drawAt =
      toApiDate(values.drawAt);

    if (
      values.startsAt &&
      !startsAt
    ) {
      setErrorMessage(
        "La fecha de inicio no es válida.",
      );
      return;
    }

    if (
      values.closesAt &&
      !closesAt
    ) {
      setErrorMessage(
        "La fecha de cierre no es válida.",
      );
      return;
    }

    if (
      values.drawAt &&
      !drawAt
    ) {
      setErrorMessage(
        "La fecha del sorteo no es válida.",
      );
      return;
    }

    if (
      startsAt &&
      closesAt &&
      new Date(closesAt).getTime() <=
        new Date(startsAt).getTime()
    ) {
      setErrorMessage(
        "La fecha de cierre debe ser posterior al inicio.",
      );
      return;
    }

    if (
      closesAt &&
      drawAt &&
      new Date(drawAt).getTime() <
        new Date(closesAt).getTime()
    ) {
      setErrorMessage(
        "La fecha del sorteo no puede ser anterior al cierre.",
      );
      return;
    }

    /*
     * Filas de premio vacías (sin nombre ni foto) se descartan en silencio;
     * una con foto pero sin nombre es un error del usuario que hay que avisar.
     */
    const cleanedPrizes = prizes
      .map((prize) => ({
        title: prize.title.trim(),
        quantity:
          Number.isInteger(prize.quantity) && prize.quantity >= 1
            ? prize.quantity
            : 1,
        imagePath: prize.imagePath,
      }))
      .filter(
        (prize) => prize.title.length > 0 || prize.imagePath !== null,
      );

    if (cleanedPrizes.some((prize) => prize.title.length === 0)) {
      setErrorMessage("Cada premio necesita un nombre.");
      return;
    }

    const requestBody = {
      ...(props.mode === "edit"
        ? {
            action: "update",
          }
        : {}),
      name,
      description:
        description || null,
      ticketPrice,
      totalTickets,
      startsAt,
      closesAt,
      drawAt,
      prizes: cleanedPrizes,
      ...(props.mode === "create"
        ? {
            imagePath: heroImagePath,
          }
        : {}),
    };

    const endpoint =
      props.mode === "create"
        ? "/api/admin/raffles"
        : `/api/admin/raffles/${props.raffleId}`;

    setIsSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "No se pudo guardar la rifa.",
        );
        return;
      }

      router.push("/admin/raffles");
      router.refresh();
    } catch (error) {
      console.error(
        "Error guardando rifa:",
        error,
      );

      setErrorMessage(
        "No se pudo conectar con el servidor.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel =
    props.mode === "create"
      ? "Crear rifa"
      : "Guardar cambios";

  const pendingLabel =
    props.mode === "create"
      ? "Creando..."
      : "Guardando...";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      noValidate
    >
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <div className="grid gap-2">
          <label
            htmlFor="raffle-name"
            className={adminLabel}
          >
            Nombre de la rifa
          </label>

          <input
            id="raffle-name"
            name="name"
            type="text"
            value={values.name}
            onChange={(event) => {
              updateField(
                "name",
                event.target.value,
              );
            }}
            minLength={3}
            maxLength={150}
            required
            disabled={isSubmitting}
            autoComplete="off"
            placeholder="Ejemplo: Sorteo Día de las Madres"
            className={inputClassName}
          />
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="raffle-description"
            className={adminLabel}
          >
            Descripción
          </label>

          <textarea
            id="raffle-description"
            name="description"
            value={values.description}
            onChange={(event) => {
              updateField(
                "description",
                event.target.value,
              );
            }}
            maxLength={2000}
            disabled={isSubmitting}
            rows={5}
            placeholder="Describe el premio y las condiciones principales."
            className={`${adminInput} resize-y`}
          />

          <p className="text-xs text-muted">
            {values.description.length}/2000
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <label
              htmlFor="raffle-ticket-price"
              className={adminLabel}
            >
              Precio por ticket
            </label>

            <input
              id="raffle-ticket-price"
              name="ticketPrice"
              type="number"
              value={values.ticketPrice}
              onChange={(event) => {
                updateField(
                  "ticketPrice",
                  event.target.value,
                );
              }}
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required
              disabled={isSubmitting}
              placeholder="500.00"
              className={inputClassName}
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="raffle-total-tickets"
              className={adminLabel}
            >
              Total de tickets
            </label>

            <input
              id="raffle-total-tickets"
              name="totalTickets"
              type="number"
              value={values.totalTickets}
              onChange={(event) => {
                updateField(
                  "totalTickets",
                  event.target.value,
                );
              }}
              min="1"
              max="1000000"
              step="1"
              inputMode="numeric"
              required
              disabled={isSubmitting}
              placeholder="100"
              className={inputClassName}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <DateField
            id="raffle-starts-at"
            label="Inicio"
            value={values.startsAt}
            disabled={isSubmitting}
            onChange={(value) => {
              updateField("startsAt", value);
            }}
          />

          <DateField
            id="raffle-closes-at"
            label="Cierre"
            value={values.closesAt}
            disabled={isSubmitting}
            onChange={(value) => {
              updateField("closesAt", value);
            }}
          />

          <DateField
            id="raffle-draw-at"
            label="Sorteo"
            value={values.drawAt}
            disabled={isSubmitting}
            onChange={(value) => {
              updateField("drawAt", value);
            }}
          />
        </div>

        <p className="text-xs leading-5 text-muted">
          Las fechas se interpretan en la hora de Perú (Lima).
        </p>
      </section>

      {props.mode === "create" ? (
        <section className="grid gap-4 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-light text-cream">
              Foto del premio mayor
            </h2>
            <p className="mt-1 text-sm text-muted">
              Es la imagen principal que verá el público. Podrás cambiarla luego
              desde la edición de la rifa.
            </p>
          </div>

          <StagedImageInput
            path={heroImagePath}
            disabled={isSubmitting}
            addLabel="Subir foto del premio mayor"
            onChange={setHeroImagePath}
          />
        </section>
      ) : null}

      <PrizeFields
        prizes={prizes}
        disabled={isSubmitting}
        onChange={setPrizes}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/admin/raffles"
          className={btnGhost}
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className={btnPrimary}
        >
          {isSubmitting
            ? pendingLabel
            : submitLabel}
        </button>
      </div>
    </form>
  );
}

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function DateField({
  id,
  label,
  value,
  disabled,
  onChange,
}: DateFieldProps) {
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className={adminLabel}
      >
        {label}
      </label>

      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        disabled={disabled}
        className={inputClassName}
      />
    </div>
  );
}