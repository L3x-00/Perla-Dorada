"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  adminInput,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSmall,
  btnSuccess,
} from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useState } from "react";

type RaffleAction =
  | "activate"
  | "close"
  | "cancel";

type RaffleActionsProps = {
  raffleId: string;
  raffleName: string;
  status: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

type ActionConfiguration = {
  label: string;
  pendingLabel: string;
  title: string;
  confirmation: string;
  confirmLabel: string;
  tone: "success" | "danger" | "default";
};

const actionConfiguration: Record<
  RaffleAction,
  ActionConfiguration
> = {
  activate: {
    label: "Activar",
    pendingLabel: "Activando...",
    title: "Activar rifa",
    confirmation:
      "Solo puede existir una rifa activa a la vez. La rifa quedará visible en el sitio y podrá recibir solicitudes.",
    confirmLabel: "Sí, activar",
    tone: "success",
  },
  close: {
    label: "Cerrar",
    pendingLabel: "Cerrando...",
    title: "Cerrar rifa",
    confirmation:
      "Ya no podrá recibir nuevas solicitudes. Las solicitudes pendientes se marcarán como expiradas.",
    confirmLabel: "Sí, cerrar",
    tone: "default",
  },
  cancel: {
    label: "Cancelar",
    pendingLabel: "Cancelando...",
    title: "Cancelar rifa",
    confirmation:
      "La rifa se marcará como cancelada. Los tickets emitidos quedarán congelados y solo podrán reasignarse de forma trazable a una nueva rifa activa. Esta operación no debe realizarse por accidente.",
    confirmLabel: "Sí, cancelar rifa",
    tone: "danger",
  },
};

export function RaffleActions({
  raffleId,
  raffleName,
  status,
}: RaffleActionsProps) {
  const router = useRouter();

  const [pendingAction, setPendingAction] =
    useState<RaffleAction | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<RaffleAction | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isPending =
    pendingAction !== null;

  /*
   * Solo se puede borrar un borrador vacío. Se exige escribir el nombre
   * exacto para que ni siquiera ese caso reversible ocurra por accidente.
   */
  const canDelete =
    status === "draft" &&
    deleteConfirmText.trim() === raffleName.trim();

  async function deleteRaffle(): Promise<void> {
    if (!canDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/raffles/${raffleId}/delete`,
        { method: "DELETE", credentials: "same-origin" },
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "No se pudo eliminar la rifa.",
        );
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error eliminando rifa:", error);
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsDeleting(false);
    }
  }

  const canEdit =
    status === "draft" ||
    status === "active";

  const canActivate =
    status === "draft";

  const canClose =
    status === "active";

  const canCancel =
    status === "draft" ||
    status === "active";

  async function executeAction(
    action: RaffleAction,
  ): Promise<void> {
    setConfirmAction(null);

    if (isPending) {
      return;
    }

    setPendingAction(action);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/raffles/${raffleId}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "No se pudo completar la operación.",
        );
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Error ejecutando acción de rifa:",
        error,
      );

      setErrorMessage(
        "No se pudo conectar con el servidor.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 lg:max-w-64 lg:justify-end">
        {canEdit ? (
          <Link
            href={`/admin/raffles/${raffleId}/edit`}
            className={`${btnGhost} ${btnSmall}`}
          >
            Editar
          </Link>
        ) : null}

        {canActivate ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction("activate")}
            className={`${btnSuccess} ${btnSmall}`}
          >
            {pendingAction === "activate"
              ? actionConfiguration.activate
                  .pendingLabel
              : actionConfiguration.activate.label}
          </button>
        ) : null}

        {canClose ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction("close")}
            className={`${btnPrimary} ${btnSmall}`}
          >
            {pendingAction === "close"
              ? actionConfiguration.close
                  .pendingLabel
              : actionConfiguration.close.label}
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction("cancel")}
            className={`${btnDanger} ${btnSmall}`}
          >
            {pendingAction === "cancel"
              ? actionConfiguration.cancel
                  .pendingLabel
              : actionConfiguration.cancel.label}
          </button>
        ) : null}

        {status === "draft" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setShowDelete((current) => !current);
              setDeleteConfirmText("");
              setErrorMessage(null);
            }}
            className={`${btnDanger} ${btnSmall}`}
          >
            Eliminar borrador
          </button>
        ) : null}
      </div>

      {showDelete ? (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-3 lg:max-w-64">
          <p className="text-xs leading-relaxed text-red-200">
            Esto borra solo un borrador vacío y no se puede deshacer. Una
            rifa con solicitudes, tickets o ganador nunca se elimina. Escribe{" "}
            <span className="font-mono text-cream">{raffleName}</span> para
            confirmar.
          </p>

          <input
            type="text"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder="Nombre de la rifa"
            autoComplete="off"
            className={`${adminInput} mt-2.5 text-xs`}
          />

          <button
            type="button"
            disabled={!canDelete || isDeleting}
            onClick={() => {
              void deleteRaffle();
            }}
            className={`${btnDanger} ${btnSmall} mt-2.5 w-full`}
          >
            {isDeleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="max-w-72 text-sm text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction ? actionConfiguration[confirmAction].title : ""}
        description={
          confirmAction ? actionConfiguration[confirmAction].confirmation : ""
        }
        confirmLabel={
          confirmAction
            ? actionConfiguration[confirmAction].confirmLabel
            : "Confirmar"
        }
        tone={confirmAction ? actionConfiguration[confirmAction].tone : "default"}
        busy={isPending}
        onConfirm={() => {
          if (confirmAction) {
            void executeAction(confirmAction);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
