"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
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
  status,
}: RaffleActionsProps) {
  const router = useRouter();

  const [pendingAction, setPendingAction] =
    useState<RaffleAction | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const isPending =
    pendingAction !== null;

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
      </div>

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