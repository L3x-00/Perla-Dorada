"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { CloseIcon, UploadIcon } from "@/components/site/icons";
import {
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
  PAYMENT_PROOF_MAX_SIZE_BYTES,
} from "@/config/storage";

type ProofUploadProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Mensaje de error propio del campo (tamaño, tipo). */
  error?: string | null;
  disabled?: boolean;
};

const ACCEPTED_FILE_TYPES = PAYMENT_PROOF_ALLOWED_MIME_TYPES.join(",");

const MAX_SIZE_LABEL = `${Math.round(
  PAYMENT_PROOF_MAX_SIZE_BYTES / (1024 * 1024),
)} MB`;

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*
 * El input de archivo nativo es feo y, sobre todo, no dice nada: el usuario
 * ve "Sin archivos seleccionados" y no sabe qué se espera de él. Aquí queda
 * oculto (sigue siendo el que envía el archivo y el que recibe el foco del
 * teclado) tras un panel que sí explica qué hace falta, acepta arrastrar y
 * soltar, y muestra la foto elegida para que el usuario compruebe que
 * adjuntó la correcta antes de enviar.
 */
export function ProofUpload({
  file,
  onFileChange,
  error = null,
  disabled = false,
}: ProofUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  /*
   * La URL de vista previa se deriva del archivo, no se guarda en estado, y
   * se revoca cuando cambia o al desmontar para no filtrar el blob.
   */
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const dropped = event.dataTransfer.files?.[0] ?? null;

    if (dropped) {
      onFileChange(dropped);
    }
  }

  function clear() {
    onFileChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="eyebrow mb-2.5 block text-muted">
        Comprobante de pago
      </p>

      {/*
        El input vive fuera del bloque de vista previa para que no queden
        botones dentro de un <label>, que es HTML inválido y rompe el clic.
      */}
      <input
        ref={inputRef}
        id={inputId}
        name="paymentProof"
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        disabled={disabled}
        onChange={(event) =>
          onFileChange(event.target.files?.[0] ?? null)
        }
        className="peer sr-only"
      />

      {!file ? (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-9 text-center transition-colors duration-300 peer-focus-visible:border-gold peer-focus-visible:ring-1 peer-focus-visible:ring-gold ${
            isDragging
              ? "border-gold bg-gold/5"
              : "border-line bg-ink hover:border-gold-deep hover:bg-ink-3/50"
          } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-deep/60 text-gold">
            <UploadIcon className="h-6 w-6" />
          </span>

          <span className="font-display text-xl font-light text-cream">
            Adjuntar captura del Yape
          </span>

          <span className="max-w-xs text-sm leading-relaxed text-muted">
            Toca aquí para elegir la foto desde tu teléfono, o arrástrala si
            estás en computadora.
          </span>

          <span className="eyebrow text-gold-deep">
            JPG · PNG · WEBP — hasta {MAX_SIZE_LABEL}
          </span>
        </label>
      ) : (
        <div className="rounded-2xl border border-line bg-ink p-4">
          <div className="flex items-center gap-4">
            {previewUrl ? (
              /*
               * <img> a propósito: la fuente es un blob: local que se
               * revoca al cambiar de archivo. next/image no aporta nada
               * aquí (no hay que optimizar ni servir nada) y su validación
               * de src rechaza los blob:.
               */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa del comprobante adjunto"
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-cream">{file.name}</p>
              <p className="mt-1 text-xs text-muted">
                {formatSize(file.size)} · listo para enviar
              </p>
            </div>

            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label="Quitar el comprobante adjunto"
              className="shrink-0 rounded-full border border-line p-2 text-muted transition-colors duration-300 hover:border-red-900 hover:text-red-300 disabled:opacity-50"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <label
            htmlFor={inputId}
            className="mt-4 inline-flex cursor-pointer text-sm text-gold underline-offset-4 hover:underline"
          >
            Elegir otra imagen
          </label>
        </div>
      )}

      {error ? (
        <p className="mt-2.5 text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
