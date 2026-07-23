"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Countdown } from "@/app/countdown";
import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
} from "@/config/storage";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";

type PurchaseFormProps = {
  ticketPrice: number;
  available: number;
};

type SuccessData = {
  requestId: string;
  trackingCode: string;
  expiresAt: string;
};

type ApiResponse = {
  ok: boolean;
  data?: SuccessData;
  error?: string;
  fields?: Record<string, string[] | undefined>;
};

const ACCEPTED_FILE_TYPES = PAYMENT_PROOF_ALLOWED_MIME_TYPES.join(",");

const inputClass =
  "w-full rounded-lg border border-line bg-ink px-4 py-3.5 text-cream outline-none transition-colors duration-300 placeholder:text-muted/60 focus:border-gold";

const labelClass = "eyebrow mb-2.5 block text-muted";

export function PurchaseForm({ ticketPrice, available }: PurchaseFormProps) {
  const router = useRouter();

  const maxQuantity = Math.max(available, 1);

  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const total = useMemo(
    () => formatCurrencyPEN(ticketPrice * quantity),
    [ticketPrice, quantity],
  );

  function clampQuantity(next: number): number {
    if (Number.isNaN(next)) {
      return 1;
    }

    return Math.min(Math.max(Math.trunc(next), 1), maxQuantity);
  }

  function decrement() {
    setQuantity((current) => clampQuantity(current - 1));
  }

  function increment() {
    setQuantity((current) => clampQuantity(current + 1));
  }

  function onFileChange(selected: File | null) {
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
      setFile(null);
      setError("El comprobante no puede superar los 5 MB.");
      return;
    }

    setFile(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!file) {
      setError("Adjunta el comprobante de pago Yape.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const formData = new FormData();
      formData.set("fullName", fullName);
      formData.set("dni", dni);
      formData.set("phone", phone);
      formData.set("whatsapp", whatsapp);
      formData.set("requestedQuantity", String(quantity));
      formData.set("paymentProof", file);

      const response = await fetch("/api/purchase-requests", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.ok || !body.data) {
        if (body.fields) {
          setFieldErrors(body.fields);
        }

        throw new Error(body.error ?? "No se pudo registrar la solicitud.");
      }

      setSuccess(body.data);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const expiresAt = formatDateTime(success.expiresAt);

    return (
      <section
        role="status"
        className="rounded-2xl border border-gold-deep bg-ink-2 p-8"
      >
        <p className="eyebrow text-gold">Solicitud registrada</p>

        <h3 className="mt-4 font-display text-3xl font-light text-cream">
          Guarda tu código
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Lo necesitarás junto con tu DNI para consultar el estado de tu
          solicitud y descargar tus boletos.
        </p>

        <p className="mt-7 font-mono text-3xl font-semibold tracking-[0.2em] text-gold">
          {success.trackingCode}
        </p>

        {expiresAt ? (
          <div className="mt-7 border-t border-line pt-5">
            <p className="eyebrow text-muted">Reserva válida hasta</p>
            <p className="mt-2 text-cream">{expiresAt}</p>
            <p className="mt-1 text-sm">
              <Countdown expiresAt={success.expiresAt} />
            </p>
          </div>
        ) : null}

        <Link
          href="/seguimiento"
          className="mt-8 inline-flex rounded-full bg-gold px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
        >
          Ver estado de mi solicitud
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-7 rounded-2xl border border-line bg-ink-2 p-7 sm:p-8"
    >
      <fieldset disabled={submitting} className="space-y-7">
        <div>
          <p className={labelClass}>Cantidad de boletos</p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={decrement}
              disabled={quantity <= 1}
              aria-label="Disminuir cantidad"
              className="h-12 w-12 rounded-full border border-line text-xl text-cream transition-colors duration-300 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) =>
                setQuantity(clampQuantity(Number(event.target.value)))
              }
              aria-label="Cantidad de boletos"
              className="h-12 w-20 rounded-lg border border-line bg-ink text-center font-display text-2xl font-light tabular-nums text-cream outline-none focus:border-gold"
            />

            <button
              type="button"
              onClick={increment}
              disabled={quantity >= maxQuantity}
              aria-label="Aumentar cantidad"
              className="h-12 w-12 rounded-full border border-line text-xl text-cream transition-colors duration-300 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>

            <span className="ml-auto text-sm text-muted">
              {available} disponibles
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-y border-line py-5">
          <span className="eyebrow text-muted">Total a pagar</span>
          <span className="font-display text-4xl font-light tabular-nums text-gold">
            {total}
          </span>
        </div>

        <div>
          <label htmlFor="fullName" className={labelClass}>
            Nombre completo
          </label>
          <input
            id="fullName"
            name="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            minLength={3}
            maxLength={150}
            autoComplete="name"
            className={inputClass}
          />
          <FieldError messages={fieldErrors.fullName} />
        </div>

        <div>
          <label htmlFor="dni" className={labelClass}>
            DNI
          </label>
          <input
            id="dni"
            name="dni"
            value={dni}
            onChange={(event) => setDni(event.target.value)}
            required
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            className={inputClass}
          />
          <FieldError messages={fieldErrors.dni} />
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              inputMode="tel"
              maxLength={15}
              autoComplete="tel"
              className={inputClass}
            />
            <FieldError messages={fieldErrors.phone} />
          </div>

          <div>
            <label htmlFor="whatsapp" className={labelClass}>
              WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              required
              inputMode="tel"
              maxLength={15}
              autoComplete="off"
              className={inputClass}
            />
            <FieldError messages={fieldErrors.whatsapp} />
          </div>
        </div>

        <div>
          <label htmlFor="paymentProof" className={labelClass}>
            Comprobante de pago Yape
          </label>
          <input
            id="paymentProof"
            name="paymentProof"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            required
            className="w-full rounded-lg border border-line bg-ink px-4 py-3.5 text-sm text-muted outline-none transition-colors file:mr-4 file:rounded-full file:border-0 file:bg-ink-3 file:px-4 file:py-2 file:text-sm file:text-cream focus:border-gold"
          />
          <p className="mt-2.5 text-xs text-muted">
            Imagen JPG, PNG o WEBP. Máximo 5 MB.
          </p>
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-gold px-7 py-4 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Enviando..." : "Enviar solicitud"}
      </button>

      <p className="text-center text-xs leading-relaxed text-muted">
        Al enviar aceptas los{" "}
        <Link href="/legal/terminos" className="text-gold hover:underline">
          términos
        </Link>{" "}
        y las{" "}
        <Link href="/legal/bases" className="text-gold hover:underline">
          bases del sorteo
        </Link>
        .
      </p>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="mt-2.5 text-xs text-red-400">{messages[0]}</p>;
}
