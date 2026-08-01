"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  btnDanger,
  btnGhost,
  btnSmall,
  btnSuccess,
} from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type PromotionActionsProps = {
  promotionId: string;
  title: string;
  enabled: boolean;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

export function PromotionActions({
  promotionId,
  title,
  enabled,
}: PromotionActionsProps) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggleEnabled(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/promotions/${promotionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_enabled" }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(result.error ?? "No se pudo actualizar la promoción.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error alternando promoción:", error);
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePromotion(): Promise<void> {
    setConfirmDelete(false);

    if (busy) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/promotions/${promotionId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(result.error ?? "No se pudo eliminar la promoción.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error eliminando promoción:", error);
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link
          href={`/admin/promotions/${promotionId}/edit`}
          className={`${btnGhost} ${btnSmall}`}
        >
          Editar
        </Link>

        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleEnabled()}
          className={`${enabled ? btnGhost : btnSuccess} ${btnSmall}`}
        >
          {enabled ? "Desactivar" : "Activar"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className={`${btnDanger} ${btnSmall}`}
        >
          Eliminar
        </button>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar promoción"
        description={`Se eliminará "${title}" y su foto (si tiene). No se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        tone="danger"
        busy={busy}
        onConfirm={() => void deletePromotion()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
