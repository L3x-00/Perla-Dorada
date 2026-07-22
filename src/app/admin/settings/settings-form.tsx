"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  MAINTENANCE_MESSAGE_MAX,
  MAX_REPRINTS_MAX,
  MAX_REPRINTS_MIN,
  RESERVATION_MINUTES_MAX,
  RESERVATION_MINUTES_MIN,
} from "@/lib/settings/validation";

type SettingsFormProps = {
  initial: {
    maintenanceMode: boolean;
    reservationMinutes: number;
    maxReprints: number;
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
  const [maxReprints, setMaxReprints] = useState(
    String(initial.maxReprints),
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
          maxReprints: Number(maxReprints),
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
      className="mt-8 max-w-xl space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
    >
      <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <div>
          <p className="font-medium">Modo mantenimiento</p>
          <p className="mt-1 text-sm text-neutral-400">
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
          <span className="h-6 w-11 rounded-full bg-neutral-700 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-amber-500 peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div>
        <label
          htmlFor="maintenanceMessage"
          className="mb-2 block text-sm font-medium"
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
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-white outline-none focus:border-amber-500"
        />
        <p className="mt-2 text-xs text-neutral-500">
          Texto que verá el público cuando el portal esté en mantenimiento.
          Máximo {MAINTENANCE_MESSAGE_MAX} caracteres.
        </p>
      </div>

      <div>
        <label
          htmlFor="reservationMinutes"
          className="mb-2 block text-sm font-medium"
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
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-white outline-none focus:border-amber-500"
        />
        <p className="mt-2 text-xs text-neutral-500">
          Tiempo que dura la reserva de una solicitud pendiente. Entre{" "}
          {RESERVATION_MINUTES_MIN} y {RESERVATION_MINUTES_MAX} minutos.
        </p>
      </div>

      <div>
        <label
          htmlFor="maxReprints"
          className="mb-2 block text-sm font-medium"
        >
          Máximo de reimpresiones
        </label>
        <input
          id="maxReprints"
          type="number"
          inputMode="numeric"
          min={MAX_REPRINTS_MIN}
          max={MAX_REPRINTS_MAX}
          value={maxReprints}
          onChange={(event) => setMaxReprints(event.target.value)}
          required
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-white outline-none focus:border-amber-500"
        />
        <p className="mt-2 text-xs text-neutral-500">
          Reimpresiones permitidas por ticket, además de la impresión
          original. Entre {MAX_REPRINTS_MIN} y {MAX_REPRINTS_MAX}.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-900 bg-red-950 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {saved ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200"
        >
          Configuración guardada.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-amber-500 px-4 py-3 font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
