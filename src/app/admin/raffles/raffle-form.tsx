"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

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
    }
  | {
      mode: "edit";
      raffleId: string;
      initialValues: RaffleFormValues;
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
  "h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60";

function getInitialValues(
  values?: Partial<RaffleFormValues>,
): RaffleFormValues {
  return {
    ...emptyValues,
    ...values,
  };
}

function toApiDate(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function RaffleForm(
  props: RaffleFormProps,
) {
  const router = useRouter();

  const [values, setValues] =
    useState<RaffleFormValues>(() =>
      getInitialValues(props.initialValues),
    );

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
          className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6">
        <div className="grid gap-2">
          <label
            htmlFor="raffle-name"
            className="text-sm font-medium"
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
            className="text-sm font-medium"
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
            className="resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <p className="text-xs text-neutral-500">
            {values.description.length}/2000
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <label
              htmlFor="raffle-ticket-price"
              className="text-sm font-medium"
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
              className="text-sm font-medium"
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

        <p className="text-xs leading-5 text-neutral-500">
          Las fechas se interpretan usando la zona horaria
          configurada en el dispositivo del administrador.
        </p>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/admin/raffles"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-700 px-5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-900"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
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
        className="text-sm font-medium"
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