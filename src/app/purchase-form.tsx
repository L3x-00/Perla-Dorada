"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
} from "@/config/storage";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import { Countdown } from "@/app/countdown";

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

        throw new Error(
          body.error ?? "No se pudo registrar la solicitud.",
        );
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
        className="rounded-2xl border border-emerald-700 bg-emerald-950/40 p-6"
      >
        <h2 className="text-xl font-bold text-emerald-200">
          ¡Solicitud registrada!
        </h2>

        <p className="mt-2 text-sm text-emerald-100/80">
          Guarda tu código de seguimiento. Lo necesitarás junto con tu DNI para
          consultar el estado de tu solicitud.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm text-neutral-400">Código de seguimiento</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-white">
              {success.trackingCode}
            </p>
          </div>

          {expiresAt ? (
            <div>
              <p className="text-sm text-neutral-400">Reserva válida hasta</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {expiresAt}
              </p>
              <p className="mt-1 text-sm">
                <Countdown expiresAt={success.expiresAt} />
              </p>
            </div>
          ) : null}
        </div>

        <Link
          href="/seguimiento"
          className="mt-6 inline-flex rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400"
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
      className="space-y-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6"
    >
      <fieldset disabled={submitting} className="space-y-6">
        <div>
          <p className="mb-2 block text-sm font-medium">Cantidad de boletos</p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={decrement}
              disabled={quantity <= 1}
              aria-label="Disminuir cantidad"
              className="h-11 w-11 rounded-lg border border-neutral-700 text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
              className="h-11 w-20 rounded-lg border border-neutral-700 bg-neutral-900 text-center text-lg font-semibold tabular-nums text-white outline-none focus:border-amber-500"
            />

            <button
              type="button"
              onClick={increment}
              disabled={quantity >= maxQuantity}
              aria-label="Aumentar cantidad"
              className="h-11 w-11 rounded-lg border border-neutral-700 text-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>

            <span className="ml-auto text-sm text-neutral-400">
              Disponibles: {available}
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
          <span className="text-sm text-neutral-400">Total a pagar</span>
          <span className="text-2xl font-bold tabular-nums text-amber-400">
            {total}
          </span>
        </div>

        <div>
          <label htmlFor="fullName" className="mb-2 block text-sm font-medium">
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
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none focus:border-amber-500"
          />
          <FieldError messages={fieldErrors.fullName} />
        </div>

        <div>
          <label htmlFor="dni" className="mb-2 block text-sm font-medium">
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
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none focus:border-amber-500"
          />
          <FieldError messages={fieldErrors.dni} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium">
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
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none focus:border-amber-500"
            />
            <FieldError messages={fieldErrors.phone} />
          </div>

          <div>
            <label
              htmlFor="whatsapp"
              className="mb-2 block text-sm font-medium"
            >
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
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none focus:border-amber-500"
            />
            <FieldError messages={fieldErrors.whatsapp} />
          </div>
        </div>

        <div>
          <label
            htmlFor="paymentProof"
            className="mb-2 block text-sm font-medium"
          >
            Comprobante de pago Yape
          </label>
          <input
            id="paymentProof"
            name="paymentProof"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) =>
              onFileChange(event.target.files?.[0] ?? null)
            }
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-sm file:text-white outline-none focus:border-amber-500"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Imagen JPG, PNG o WEBP. Máximo 5 MB.
          </p>
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900 bg-red-950 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <p className="mt-2 text-xs text-red-400">{messages[0]}</p>
  );
}
