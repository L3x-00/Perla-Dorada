"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PAYMENT_PROOF_MAX_SIZE_BYTES } from "@/config/storage";
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
      const body = new FormData();
      body.set("image", file);

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
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="text-lg font-semibold text-white">Foto del premio</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Es la imagen que ve el público en la web. Usa una foto nítida y
        horizontal; JPG, PNG o WEBP de hasta 5 MB.
      </p>

      {preview ? (
        <div className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Premio de la rifa"
            className="max-h-64 w-full rounded-xl border border-neutral-800 object-cover"
          />
        </div>
      ) : (
        <div className="mt-5 flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-700 text-sm text-neutral-500">
          Sin foto: la web mostrará la rifa sin imagen del premio.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300">
          {busy ? "Procesando..." : preview ? "Cambiar foto" : "Subir foto"}
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
            className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
