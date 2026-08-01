"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  adminInput,
  adminLabel,
  btnGhost,
  btnPrimary,
} from "@/components/admin/ui";
import { limaInputToIso } from "@/lib/datetime-lima";

import { StagedPromoImageInput } from "./staged-promo-image-input";

export type RaffleOption = {
  id: string;
  name: string;
  status: string;
};

export type PromotionFormValues = {
  title: string;
  description: string;
  imagePath: string | null;
  ctaKind: "raffle" | "url";
  ctaRaffleId: string;
  ctaUrl: string;
  ctaText: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
};

type PromotionFormProps =
  | {
      mode: "create";
      promotionId?: never;
      initialValues?: Partial<PromotionFormValues>;
      raffles: RaffleOption[];
    }
  | {
      mode: "edit";
      promotionId: string;
      initialValues: PromotionFormValues;
      raffles: RaffleOption[];
    };

type ApiResponse = {
  success?: boolean;
  error?: string;
  fields?: Record<string, string[] | undefined>;
};

const emptyValues: PromotionFormValues = {
  title: "",
  description: "",
  imagePath: null,
  ctaKind: "raffle",
  ctaRaffleId: "",
  ctaUrl: "",
  ctaText: "Ver más",
  startsAt: "",
  endsAt: "",
  enabled: true,
};

function getInitialValues(
  values?: Partial<PromotionFormValues>,
): PromotionFormValues {
  return { ...emptyValues, ...values };
}

/*
 * Crear/editar promoción del carrusel de bienvenida.
 *
 * El CTA tiene dos modos: "raffle" (redirige a la sección del sorteo — el
 * sitio solo muestra una rifa activa a la vez, así que elegir cuál es solo
 * para que el admin recuerde de qué campaña se trata) o "url" (un enlace
 * propio, interno como /#sorteo o externo como WhatsApp).
 */
export function PromotionForm(props: PromotionFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<PromotionFormValues>(() =>
    getInitialValues(props.initialValues),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  function updateField<K extends keyof PromotionFormValues>(
    field: K,
    value: PromotionFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});

    const title = values.title.trim();
    const description = values.description.trim();
    const ctaText = values.ctaText.trim();

    if (title.length < 3) {
      setErrorMessage("El título debe tener al menos 3 caracteres.");
      return;
    }

    if (ctaText.length === 0) {
      setErrorMessage("El texto del botón es obligatorio.");
      return;
    }

    if (values.ctaKind === "raffle" && !values.ctaRaffleId) {
      setErrorMessage("Selecciona a qué sorteo redirige el enlace.");
      return;
    }

    if (values.ctaKind === "url" && values.ctaUrl.trim().length === 0) {
      setErrorMessage("Ingresa el enlace de destino.");
      return;
    }

    const startsAt = values.startsAt ? limaInputToIso(values.startsAt) : null;
    const endsAt = values.endsAt ? limaInputToIso(values.endsAt) : null;

    if (
      startsAt &&
      endsAt &&
      new Date(endsAt).getTime() < new Date(startsAt).getTime()
    ) {
      setErrorMessage("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }

    const requestBody = {
      title,
      description,
      imagePath: values.imagePath,
      ctaKind: values.ctaKind,
      ctaRaffleId: values.ctaKind === "raffle" ? values.ctaRaffleId : null,
      ctaUrl: values.ctaKind === "url" ? values.ctaUrl.trim() : null,
      ctaText,
      startsAt,
      endsAt,
      enabled: values.enabled,
    };

    const endpoint =
      props.mode === "create"
        ? "/api/admin/promotions"
        : `/api/admin/promotions/${props.promotionId}`;

    setIsSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(result.error ?? "No se pudo guardar la promoción.");
        setFieldErrors(result.fields ?? {});
        return;
      }

      router.push("/admin/promotions");
      router.refresh();
    } catch (error) {
      console.error("Error guardando promoción:", error);
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
          <label htmlFor="promo-title" className={adminLabel}>
            Título
          </label>
          <input
            id="promo-title"
            value={values.title}
            onChange={(event) => updateField("title", event.target.value)}
            minLength={3}
            maxLength={150}
            required
            disabled={isSubmitting}
            placeholder="Ejemplo: ¡Sorteo especial! 2×1 en boletos"
            className={adminInput}
          />
          <FieldError messages={fieldErrors.title} />
        </div>

        <div className="grid gap-2">
          <label htmlFor="promo-description" className={adminLabel}>
            Descripción
          </label>
          <textarea
            id="promo-description"
            value={values.description}
            onChange={(event) =>
              updateField("description", event.target.value)
            }
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            placeholder="Describe la promoción en una o dos frases."
            className={`${adminInput} resize-y`}
          />
          <p className="text-xs text-muted">{values.description.length}/500</p>
          <FieldError messages={fieldErrors.description} />
        </div>

        <div className="grid gap-2">
          <span className={adminLabel}>Foto</span>
          <StagedPromoImageInput
            path={values.imagePath}
            disabled={isSubmitting}
            onChange={(path) => updateField("imagePath", path)}
          />
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <div className="grid gap-2">
          <span className={adminLabel}>El botón redirige a</span>

          <div
            role="radiogroup"
            aria-label="El botón redirige a"
            className="inline-flex w-fit rounded-full border border-line p-1"
          >
            {(["raffle", "url"] as const).map((kind) => {
              const active = values.ctaKind === kind;

              return (
                <label
                  key={kind}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
                    active
                      ? "bg-gold font-medium text-ink"
                      : "text-muted hover:text-cream"
                  }`}
                >
                  <input
                    type="radio"
                    name="cta-kind"
                    value={kind}
                    checked={active}
                    disabled={isSubmitting}
                    onChange={() => updateField("ctaKind", kind)}
                    className="sr-only"
                  />
                  {kind === "raffle" ? "Un sorteo" : "Un enlace propio"}
                </label>
              );
            })}
          </div>
        </div>

        {values.ctaKind === "raffle" ? (
          <div className="grid gap-2">
            <label htmlFor="promo-raffle" className={adminLabel}>
              Sorteo
            </label>
            <select
              id="promo-raffle"
              value={values.ctaRaffleId}
              onChange={(event) =>
                updateField("ctaRaffleId", event.target.value)
              }
              disabled={isSubmitting}
              className={adminInput}
            >
              <option value="">Selecciona un sorteo…</option>
              {props.raffles.map((raffle) => (
                <option key={raffle.id} value={raffle.id}>
                  {raffle.name} ({RAFFLE_STATUS_LABEL[raffle.status] ?? raffle.status})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              El botón lleva a la sección del sorteo vigente en la portada.
              Solo hay un sorteo activo a la vez, así que elegir uno aquí es
              para que sepas de qué campaña se trata esta promoción.
            </p>
            <FieldError messages={fieldErrors.ctaRaffleId} />
          </div>
        ) : (
          <div className="grid gap-2">
            <label htmlFor="promo-url" className={adminLabel}>
              Enlace
            </label>
            <input
              id="promo-url"
              value={values.ctaUrl}
              onChange={(event) => updateField("ctaUrl", event.target.value)}
              disabled={isSubmitting}
              placeholder="https://wa.me/51... o /#sorteo"
              className={adminInput}
            />
            <p className="text-xs text-muted">
              URL completa (https://…) para enlaces externos, o una ruta que
              empiece con &quot;/&quot; para una página propia del sitio.
            </p>
            <FieldError messages={fieldErrors.ctaUrl} />
          </div>
        )}

        <div className="grid gap-2">
          <label htmlFor="promo-cta-text" className={adminLabel}>
            Texto del botón
          </label>
          <input
            id="promo-cta-text"
            value={values.ctaText}
            onChange={(event) => updateField("ctaText", event.target.value)}
            maxLength={40}
            required
            disabled={isSubmitting}
            placeholder="Ver sorteo"
            className={adminInput}
          />
          <FieldError messages={fieldErrors.ctaText} />
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <DateField
            id="promo-starts-at"
            label="Inicio de vigencia"
            value={values.startsAt}
            disabled={isSubmitting}
            onChange={(value) => updateField("startsAt", value)}
          />
          <DateField
            id="promo-ends-at"
            label="Fin de vigencia"
            value={values.endsAt}
            disabled={isSubmitting}
            onChange={(value) => updateField("endsAt", value)}
          />
        </div>
        <p className="-mt-2 text-xs leading-5 text-muted">
          Ambas son opcionales. Sin fechas, la promoción se muestra mientras
          esté activa. Las fechas se interpretan en la hora de Perú (Lima).
        </p>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-cream">
          <input
            type="checkbox"
            checked={values.enabled}
            disabled={isSubmitting}
            onChange={(event) => updateField("enabled", event.target.checked)}
            className="peer sr-only"
          />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line text-ink transition-colors duration-300 peer-checked:border-gold peer-checked:bg-gold">
            {values.enabled ? <CheckMark /> : null}
          </span>
          Promoción activa
        </label>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/admin/promotions" className={btnGhost}>
          Cancelar
        </Link>
        <button type="submit" disabled={isSubmitting} className={btnPrimary}>
          {isSubmitting
            ? props.mode === "create"
              ? "Creando…"
              : "Guardando…"
            : props.mode === "create"
              ? "Crear promoción"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

const RAFFLE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DateField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={adminLabel}>
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={adminInput}
      />
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="text-xs text-red-300">{messages[0]}</p>;
}
