"use client";

import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { FormEvent, useMemo, useState } from "react";

import { Countdown } from "@/app/countdown";
import { DocumentField } from "@/components/site/document-field";
import {
  siteInputClass,
  siteLabelClass,
} from "@/components/site/form-controls";
import { CheckIcon, CopyIcon } from "@/components/site/icons";
import { ProofUpload } from "@/components/site/proof-upload";
import { brand, hasPaymentInfo } from "@/config/brand";
import { MAX_TICKETS_PER_PURCHASE_REQUEST } from "@/config/purchase";
import { PAYMENT_PROOF_MAX_SIZE_BYTES } from "@/config/storage";
import { useClipboard } from "@/lib/clipboard";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import {
  validateDocumentNumber,
  type DocumentType,
} from "@/lib/validation/document";

type PurchaseWizardProps = {
  ticketPrice: number;
  available: number;
  /** Se dispara al registrar la solicitud (paso 3 alcanzado). */
  onSuccess?: () => void;
  /** Se llama cuando el usuario pulsa "Cerrar" en la pantalla de éxito. */
  onFinished?: () => void;
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

type FieldErrors = Record<string, string | undefined>;

const STEPS = [
  { id: 1, label: "Tus datos" },
  { id: 2, label: "Pago" },
  { id: 3, label: "Listo" },
] as const;

/*
 * Asistente de participación en 3 fases.
 *
 * Es SOLO presentación: divide el mismo formulario de siempre en pasos y le
 * añade transiciones. El envío (FormData → POST /api/purchase-requests) y las
 * reglas del backend no cambian; la validación por paso es una comodidad para
 * no avanzar con campos vacíos, no la autoridad.
 */
export function PurchaseWizard({
  ticketPrice,
  available,
  onSuccess,
  onFinished,
}: PurchaseWizardProps) {
  const reduceMotion = useReducedMotion();
  const maxQuantity = Math.min(
    Math.max(available, 1),
    MAX_TICKETS_PER_PURCHASE_REQUEST,
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState(1);

  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("dni");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrors, setServerErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const total = useMemo(
    () => formatCurrencyPEN(ticketPrice * quantity),
    [ticketPrice, quantity],
  );

  const effectiveWhatsapp = whatsappSameAsPhone ? phone : whatsapp;

  function goTo(next: 1 | 2 | 3) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function clampQuantity(next: number): number {
    if (Number.isNaN(next)) {
      return 1;
    }

    return Math.min(Math.max(Math.trunc(next), 1), maxQuantity);
  }

  function onFileChange(selected: File | null) {
    setFileError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
      setFile(null);
      setFileError("El comprobante no puede superar los 5 MB.");
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setFile(null);
      setFileError("Adjunta una imagen JPG, PNG o WEBP.");
      return;
    }

    setFile(selected);
  }

  /** Valida el paso 1 en el cliente antes de avanzar. */
  function validateStepOne(): boolean {
    const next: FieldErrors = {};

    if (fullName.trim().length < 3) {
      next.fullName = "Ingresa tu nombre completo.";
    }

    const documentMessage = validateDocumentNumber(
      documentType,
      documentNumber,
    );

    if (documentMessage) {
      next.dni = documentMessage;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    if (phoneDigits.length < 7) {
      next.phone = "El teléfono no es válido.";
    }

    if (!whatsappSameAsPhone) {
      const whatsappDigits = whatsapp.replace(/\D/g, "");

      if (whatsappDigits.length < 7) {
        next.whatsapp = "El WhatsApp no es válido.";
      }
    }

    setFieldErrors(next);

    return Object.keys(next).length === 0;
  }

  function handleContinue() {
    if (validateStepOne()) {
      setError(null);
      goTo(2);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!file) {
      setFileError("Adjunta el comprobante de pago Yape.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setServerErrors({});

    try {
      const formData = new FormData();
      formData.set("fullName", fullName);
      formData.set("documentType", documentType);
      formData.set("dni", documentNumber);
      formData.set("phone", phone);
      formData.set("whatsapp", effectiveWhatsapp);
      formData.set("requestedQuantity", String(quantity));
      formData.set("paymentProof", file);

      const response = await fetch("/api/purchase-requests", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.ok || !body.data) {
        if (body.fields) {
          setServerErrors(body.fields);
        }

        throw new Error(body.error ?? "No se pudo registrar la solicitud.");
      }

      setSuccess(body.data);
      setDirection(1);
      setStep(3);
      onSuccess?.();
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

  const slide = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: direction * 40 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -40 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="flex flex-col">
      <Stepper current={step} />

      <div className="relative mt-8 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.div key="step-1" {...slide}>
              <StepHeader
                eyebrow="Paso 1 de 3"
                title="Tus datos"
                description="Con esto identificamos tu participación. Nada se comparte."
              />

              <div className="mt-7 space-y-6">
                <div>
                  <label htmlFor="wiz-name" className={siteLabelClass}>
                    Nombre completo
                  </label>
                  <input
                    id="wiz-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    minLength={3}
                    maxLength={150}
                    autoComplete="name"
                    className={siteInputClass}
                  />
                  <FieldError message={fieldErrors.fullName} />
                </div>

                <div>
                  <DocumentField
                    idPrefix="wiz"
                    documentType={documentType}
                    onDocumentTypeChange={setDocumentType}
                    value={documentNumber}
                    onValueChange={setDocumentNumber}
                  />
                  <FieldError message={fieldErrors.dni} />
                </div>

                <div>
                  <label htmlFor="wiz-phone" className={siteLabelClass}>
                    Teléfono
                  </label>
                  <input
                    id="wiz-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    inputMode="tel"
                    maxLength={15}
                    autoComplete="tel"
                    className={siteInputClass}
                  />
                  <FieldError message={fieldErrors.phone} />

                  <label className="mt-3.5 flex cursor-pointer items-center gap-3 text-sm text-cream">
                    <input
                      type="checkbox"
                      checked={whatsappSameAsPhone}
                      onChange={(event) =>
                        setWhatsappSameAsPhone(event.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line text-ink transition-colors duration-300 peer-checked:border-gold peer-checked:bg-gold peer-focus-visible:ring-1 peer-focus-visible:ring-gold">
                      {whatsappSameAsPhone ? (
                        <CheckIcon className="h-3.5 w-3.5" />
                      ) : null}
                    </span>
                    Este mismo número es mi WhatsApp
                  </label>
                </div>

                <AnimatePresence initial={false}>
                  {!whatsappSameAsPhone ? (
                    <motion.div
                      initial={
                        reduceMotion ? false : { opacity: 0, height: 0 }
                      }
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <label htmlFor="wiz-whatsapp" className={siteLabelClass}>
                        WhatsApp
                      </label>
                      <input
                        id="wiz-whatsapp"
                        value={whatsapp}
                        onChange={(event) => setWhatsapp(event.target.value)}
                        inputMode="tel"
                        maxLength={15}
                        autoComplete="off"
                        className={siteInputClass}
                      />
                      <FieldError message={fieldErrors.whatsapp} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="mt-9">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full rounded-full bg-gold px-7 py-4 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div key="step-2" {...slide}>
              <StepHeader
                eyebrow="Paso 2 de 3"
                title="Paga y adjunta tu comprobante"
                description="Yapea el monto exacto y sube la captura. Verificamos cada pago a mano."
              />

              <form onSubmit={submit} noValidate className="mt-7">
                <fieldset disabled={submitting} className="space-y-7">
                  <div className="grid gap-7 md:grid-cols-2 md:items-start">
                    {/* Datos de pago Yape */}
                    <YapePanel />

                    {/* Cantidad + total + comprobante */}
                    <div className="space-y-6">
                      <div>
                        <p className={siteLabelClass}>Cantidad de boletos</p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity((current) =>
                                clampQuantity(current - 1),
                              )
                            }
                            disabled={quantity <= 1}
                            aria-label="Disminuir cantidad"
                            className="h-11 w-11 rounded-full border border-line text-xl text-cream transition-colors duration-300 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
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
                            className="h-11 w-16 rounded-lg border border-line bg-ink text-center font-display text-xl font-light tabular-nums text-cream outline-none focus:border-gold"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity((current) =>
                                clampQuantity(current + 1),
                              )
                            }
                            disabled={quantity >= maxQuantity}
                            aria-label="Aumentar cantidad"
                            className="h-11 w-11 rounded-full border border-line text-xl text-cream transition-colors duration-300 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            +
                          </button>
                          <span className="ml-auto text-xs text-muted">
                            {available} disp.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between border-y border-line py-4">
                        <span className="eyebrow text-muted">Total</span>
                        <motion.span
                          key={total}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="font-display text-3xl font-light tabular-nums text-gold"
                        >
                          {total}
                        </motion.span>
                      </div>

                      <ProofUpload
                        file={file}
                        onFileChange={onFileChange}
                        error={fileError}
                        disabled={submitting}
                      />
                      <ServerFieldError messages={serverErrors.paymentProof} />
                    </div>
                  </div>

                  <ServerFieldError messages={serverErrors.dni} />
                </fieldset>

                {error ? (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200"
                  >
                    {error}
                  </div>
                ) : null}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    disabled={submitting}
                    className="rounded-full border border-line px-7 py-3.5 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold disabled:opacity-50 sm:flex-1"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-gold px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[2]"
                  >
                    {submitting ? "Enviando..." : "Enviar solicitud"}
                  </button>
                </div>

                <p className="mt-5 text-center text-xs leading-relaxed text-muted">
                  Al enviar aceptas los{" "}
                  <Link
                    href="/legal/terminos"
                    className="text-gold hover:underline"
                  >
                    términos
                  </Link>{" "}
                  y las{" "}
                  <Link
                    href="/legal/bases"
                    className="text-gold hover:underline"
                  >
                    bases del sorteo
                  </Link>
                  .
                </p>
              </form>
            </motion.div>
          ) : null}

          {step === 3 && success ? (
            <motion.div key="step-3" {...slide}>
              <SuccessStep data={success} onFinished={onFinished} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((item, index) => {
        const done = item.id < current;
        const active = item.id === current;

        return (
          <li key={item.id} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm tabular-nums transition-colors duration-500 ${
                  active
                    ? "border-gold bg-gold font-medium text-ink"
                    : done
                      ? "border-gold-deep bg-gold-deep/20 text-gold"
                      : "border-line text-muted"
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : item.id}
              </span>
              <span
                className={`hidden text-sm transition-colors duration-500 sm:inline ${
                  active ? "text-cream" : "text-muted"
                }`}
              >
                {item.label}
              </span>
            </div>

            {index < STEPS.length - 1 ? (
              <span className="relative mx-1 h-px flex-1 overflow-hidden bg-line">
                <motion.span
                  className="absolute inset-0 bg-gold-deep"
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.5 }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="eyebrow text-gold">{eyebrow}</p>
      <h3 className="mt-3 font-display text-2xl font-light text-cream sm:text-3xl">
        {title}
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

/*
 * Panel de pago Yape dentro del paso 2: QR, titular, número y copiar. Si aún
 * no se configuró el Yape, muestra una nota en lugar de un bloque vacío.
 */
function YapePanel() {
  const configured = hasPaymentInfo();
  const { state, copy } = useClipboard();

  return (
    <div className="rounded-2xl border border-line bg-ink p-5">
      <p className="eyebrow text-gold">Paga con Yape</p>

      {configured ? (
        <>
          {brand.payment.qrImage ? (
            <div className="mx-auto mt-5 w-fit rounded-xl border border-line bg-cream p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.payment.qrImage}
                alt="Código QR de Yape"
                width={170}
                height={170}
                className="h-[170px] w-[170px] object-contain"
              />
            </div>
          ) : null}

          <dl className="mt-5 space-y-3.5">
            {brand.payment.holder ? (
              <div>
                <dt className="eyebrow text-muted">Titular</dt>
                <dd className="mt-1 text-cream">{brand.payment.holder}</dd>
              </div>
            ) : null}

            {brand.payment.yapeNumber ? (
              <div>
                <dt className="eyebrow text-muted">Número</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-display text-xl font-light tabular-nums text-gold">
                    {brand.payment.yapeNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copy(brand.payment.yapeNumber)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
                  >
                    {state === "copied" ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" />
                    )}
                    {state === "copied" ? "Copiado" : "Copiar"}
                  </button>
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Transfiere el <span className="text-cream">monto exacto</span> y
            sube la captura al costado.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Los datos de pago se coordinan por WhatsApp. Escríbenos y te
          indicamos cómo yapear antes de subir tu comprobante.
        </p>
      )}
    </div>
  );
}

function SuccessStep({
  data,
  onFinished,
}: {
  data: SuccessData;
  onFinished?: () => void;
}) {
  const { state, copy } = useClipboard();
  const reduceMotion = useReducedMotion();
  const expiresAt = formatDateTime(data.expiresAt);

  return (
    <div className="text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-gold/10 text-gold"
      >
        <CheckIcon className="h-8 w-8" />
      </motion.div>

      <p className="eyebrow mt-6 text-gold">¡Gracias por participar!</p>
      <h3 className="mt-3 font-display text-3xl font-light text-cream">
        Solicitud registrada
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        Tu solicitud quedó <span className="text-cream">pendiente de aprobación</span>.
        Verificamos tu comprobante y te asignamos tus boletos. Guarda este código
        único: junto con tu documento podrás consultar todas tus compras.
      </p>

      <div className="mx-auto mt-7 flex w-fit flex-col items-center gap-3">
        <p className="font-mono text-4xl font-semibold tracking-[0.25em] text-gold">
          {data.trackingCode}
        </p>
        <button
          type="button"
          onClick={() => void copy(data.trackingCode)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
        >
          {state === "copied" ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
          {state === "copied" ? "Código copiado" : "Copiar código"}
        </button>
      </div>

      {expiresAt ? (
        <div className="mx-auto mt-7 max-w-xs border-t border-line pt-5">
          <p className="eyebrow text-muted">Reserva válida hasta</p>
          <p className="mt-2 text-cream">{expiresAt}</p>
          <p className="mt-1 text-sm">
            <Countdown expiresAt={data.expiresAt} />
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onFinished}
          className="rounded-full border border-line px-7 py-3.5 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
        >
          Cerrar
        </button>
        <Link
          href="/seguimiento"
          className="rounded-full bg-gold px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
        >
          Ver estado de mi solicitud
        </Link>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2.5 text-xs text-red-400">{message}</p>;
}

function ServerFieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="mt-2.5 text-xs text-red-400">{messages[0]}</p>;
}
