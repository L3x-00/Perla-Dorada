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
  confirmation: string;
};

const actionConfiguration: Record<
  RaffleAction,
  ActionConfiguration
> = {
  activate: {
    label: "Activar",
    pendingLabel: "Activando...",
    confirmation:
      "¿Confirmas que deseas activar esta rifa? Solo puede existir una rifa activa.",
  },
  close: {
    label: "Cerrar",
    pendingLabel: "Cerrando...",
    confirmation:
      "¿Confirmas que deseas cerrar esta rifa? Ya no podrá recibir nuevas solicitudes.",
  },
  cancel: {
    label: "Cancelar",
    pendingLabel: "Cancelando...",
    confirmation:
      "¿Confirmas que deseas cancelar esta rifa? Esta operación no debe realizarse por accidente.",
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

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isPending =
    pendingAction !== null;

  /*
   * Borrar es irreversible y arrastra solicitudes, tickets y ganador. Se
   * exige escribir el nombre exacto de la rifa, no basta un confirm(), para
   * que no ocurra por accidente.
   */
  const canDelete = deleteConfirmText.trim() === raffleName.trim();

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
    const configuration =
      actionConfiguration[action];

    const confirmed = window.confirm(
      configuration.confirmation,
    );

    if (!confirmed || isPending) {
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
            onClick={() => {
              void executeAction("activate");
            }}
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
            onClick={() => {
              void executeAction("close");
            }}
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
            onClick={() => {
              void executeAction("cancel");
            }}
            className={`${btnDanger} ${btnSmall}`}
          >
            {pendingAction === "cancel"
              ? actionConfiguration.cancel
                  .pendingLabel
              : actionConfiguration.cancel.label}
          </button>
        ) : null}

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
          Eliminar
        </button>
      </div>

      {showDelete ? (
        <div className="rounded-lg border border-red-900/70 bg-red-950/20 p-3 lg:max-w-64">
          <p className="text-xs leading-relaxed text-red-200">
            Esto borra la rifa y <strong>todas</strong> sus solicitudes,
            tickets, impresiones y el ganador. No se puede deshacer. Escribe{" "}
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
    </div>
  );
}