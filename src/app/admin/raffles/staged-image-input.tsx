"use client";

import { useState } from "react";

import { PAYMENT_PROOF_MAX_SIZE_BYTES } from "@/config/storage";
import {
  RAFFLE_IMAGE_COMPRESSION,
  compressImageFile,
} from "@/lib/images/compress-client";
import { raffleImageUrl } from "@/lib/storage/public-url";

type StagedImageInputProps = {
  path: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
  /** Texto del botón de subida cuando aún no hay imagen. */
  addLabel?: string;
};

/*
 * Sube una foto ANTES de guardar la rifa y expone su ruta. La foto se envía a
 * /api/admin/raffles/prize-image (bucket público) y lo único que se conserva
 * en el formulario es la ruta devuelta; al guardar viaja como texto dentro de
 * la rifa (foto del premio mayor) o de un premio de la lista.
 *
 * "Quitar" solo suelta la referencia local; el objeto en Storage lo recoge la
 * limpieza del guardado (o queda huérfano si se abandona el formulario).
 */
export function StagedImageInput({
  path,
  onChange,
  disabled = false,
  addLabel = "Subir foto",
}: StagedImageInputProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = raffleImageUrl(path);

  async function upload(file: File) {
    if (file.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      /*
       * Se optimiza en el navegador antes de subir: baja el peso de la foto
       * que se sirve a todos los visitantes de la landing sin usar ningún job de
       * pago. Si Canvas falla, no se sube el archivo original.
       */
      let uploadFile = file;
      try {
        uploadFile = await compressImageFile(file, RAFFLE_IMAGE_COMPRESSION);
      } catch {
        /* El endpoint reencoda antes de Storage; el original no persiste. */
      }

      const body = new FormData();
      body.set("image", uploadFile);

      const response = await fetch("/api/admin/raffles/prize-image", {
        method: "POST",
        credentials: "same-origin",
        body,
      });

      const result = (await response.json()) as {
        success?: boolean;
        path?: string;
        error?: string;
      };

      if (!response.ok || !result.success || !result.path) {
        throw new Error(result.error ?? "No se pudo subir la imagen.");
      }

      onChange(result.path);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocurrió un error inesperado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={preview}
          alt="Vista previa del premio"
          className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-[0.6rem] uppercase tracking-widest text-muted">
          Sin foto
        </div>
      )}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-line px-3 py-1.5 text-xs text-cream transition-colors duration-200 hover:border-gold hover:text-gold">
            {busy ? "Optimizando y subiendo…" : preview ? "Cambiar" : addLabel}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void upload(file);
                }
              }}
            />
          </label>

          {preview ? (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
              className="text-xs text-muted transition-colors hover:text-red-300"
            >
              Quitar
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-1 text-xs text-red-300">
            {error}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">JPG, PNG o WEBP · máx. 5 MB</p>
        )}
      </div>
    </div>
  );
}
