"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnGhost } from "@/components/admin/ui";

import { PAYMENT_PROOF_MAX_SIZE_BYTES } from "@/config/storage";
import {
  RAFFLE_IMAGE_COMPRESSION,
  compressImageFile,
} from "@/lib/images/compress-client";
import { raffleImageUrl } from "@/lib/storage/public-url";

type RaffleImageUploadProps = {
  raffleId: string;
  currentPath: string | null;
};

export function RaffleImageUpload({
  raffleId,
  currentPath,
}: RaffleImageUploadProps) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(
    raffleImageUrl(currentPath),
  );

  async function upload(file: File) {
    if (file.size > PAYMENT_PROOF_MAX_SIZE_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      /*
       * Optimización en el navegador antes de subir: esta foto se sirve a
       * todos los visitantes de la landing, así que su peso es el que más pesa en
       * el egress público. Si Canvas falla, no se sube el original: se pide
       * otra imagen y el servidor mantiene el mismo tope como defensa final.
       */
      let uploadFile = file;
      try {
        uploadFile = await compressImageFile(file, RAFFLE_IMAGE_COMPRESSION);
      } catch {
        /* El endpoint reencoda antes de Storage; el original no persiste. */
      }

      const body = new FormData();
      body.set("image", uploadFile);

      const response = await fetch(`/api/admin/raffles/${raffleId}/image`, {
        method: "POST",
        credentials: "same-origin",
        body,
      });

      const result = (await response.json()) as {
        success?: boolean;
        imagePath?: string;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo subir la imagen.");
      }

      setPreview(raffleImageUrl(result.imagePath ?? null));
      router.refresh();
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

  async function remove() {
    if (!window.confirm("¿Quitar la foto del premio?")) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/raffles/${raffleId}/image`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo quitar la imagen.");
      }

      setPreview(null);
      router.refresh();
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
    <section className="rounded-xl border border-line bg-ink-2 p-6">
      <h2 className="font-display text-2xl font-light text-cream">Foto del premio</h2>
      <p className="mt-1.5 text-sm text-muted">
        Es la imagen que ve el público en la web. Usa una foto nítida y
        horizontal; JPG, PNG o WEBP de hasta 5 MB.
      </p>

      {preview ? (
        <div className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Premio de la rifa"
            className="max-h-64 w-full rounded-lg border border-line object-cover"
          />
        </div>
      ) : (
        <div className="mt-5 flex h-40 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
          Sin foto: la web mostrará la rifa sin imagen del premio.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-gold-soft">
          {busy ? "Optimizando y subiendo..." : preview ? "Cambiar foto" : "Subir foto"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
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
            onClick={remove}
            disabled={busy}
            className={btnGhost}
          >
            Quitar
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
