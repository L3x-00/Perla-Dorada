"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  adminInput,
  adminLabel,
  btnPrimary,
} from "@/components/admin/ui";

import {
  MAINTENANCE_MESSAGE_MAX,
  RESERVATION_MINUTES_MAX,
  RESERVATION_MINUTES_MIN,
} from "@/lib/settings/validation";

type SettingsFormProps = {
  initial: {
    maintenanceMode: boolean;
    reservationMinutes: number;
    maintenanceMessage: string;
  };
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  fields?: Record<string, string[] | undefined>;
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();

  const [maintenanceMode, setMaintenanceMode] = useState(
    initial.maintenanceMode,
  );
  const [reservationMinutes, setReservationMinutes] = useState(
    String(initial.reservationMinutes),
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    initial.maintenanceMessage,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceMode,
          reservationMinutes: Number(reservationMinutes),
          maintenanceMessage,
        }),
      });

      const body = (await response.json()) as ApiResponse;

      if (!response.ok || !body.success) {
        throw new Error(
          body.error ?? "No se pudo guardar la configuración.",
        );
      }

      setSaved(true);
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

  return (
    <form
      onSubmit={submit}
      className="mt-8 max-w-xl space-y-6 rounded-2xl border border-line bg-ink-2 p-6"
    >
      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-ink p-4">
        <div>
          <p className="font-medium">Modo mantenimiento</p>
          <p className="mt-1 text-sm text-muted">
            Al activarlo, el portal público deja de aceptar nuevas
            solicitudes. El panel administrativo sigue disponible.
          </p>
        </div>

        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(event) => setMaintenanceMode(event.target.checked)}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-ink-3 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-cream after:transition-all peer-checked:bg-gold peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div>
        <label
          htmlFor="maintenanceMessage"
          className={adminLabel}
        >
          Mensaje de mantenimiento
        </label>
        <textarea
          id="maintenanceMessage"
          value={maintenanceMessage}
          onChange={(event) => setMaintenanceMessage(event.target.value)}
          maxLength={MAINTENANCE_MESSAGE_MAX}
          rows={3}
          placeholder="Opcional. Si se deja vacío, se muestra el mensaje por defecto."
          className={adminInput}
        />
        <p className="mt-2 text-xs text-muted">
          Texto que verá el público cuando el portal esté en mantenimiento.
          Máximo {MAINTENANCE_MESSAGE_MAX} caracteres.
        </p>
      </div>

      <div>
        <label
          htmlFor="reservationMinutes"
          className={adminLabel}
        >
          Minutos de reserva
        </label>
        <input
          id="reservationMinutes"
          type="number"
          inputMode="numeric"
          min={RESERVATION_MINUTES_MIN}
          max={RESERVATION_MINUTES_MAX}
          value={reservationMinutes}
          onChange={(event) => setReservationMinutes(event.target.value)}
          required
          className={adminInput}
        />
        <p className="mt-2 text-xs text-muted">
          Tiempo que dura la reserva de una solicitud pendiente. Entre{" "}
          {RESERVATION_MINUTES_MIN} y {RESERVATION_MINUTES_MAX} minutos.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {saved ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-800/70 bg-emerald-950/25 p-4 text-sm text-emerald-200"
        >
          Configuración guardada.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={btnPrimary}
      >
        {submitting ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
