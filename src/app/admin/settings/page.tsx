import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireActiveAdminPage();

  const adminClient = createAdminClient();

  const { data: settings, error } = await adminClient
    .from("app_settings")
    .select(
      "maintenance_mode, reservation_minutes, max_reprints, maintenance_message",
    )
    .eq("id", true)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-cream sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-medium text-gold">
            Joyería Perla Dorada
          </p>

          <h1 className="mt-1 text-3xl font-semibold">Configuración</h1>

          <p className="mt-2 text-sm text-muted">
            Ajustes generales del sistema de rifas.
          </p>
        </header>

        {error || !settings ? (
          <div className="mt-8 max-w-xl rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            No se pudo cargar la configuración.
          </div>
        ) : (
          <SettingsForm
            initial={{
              maintenanceMode: settings.maintenance_mode,
              reservationMinutes: settings.reservation_minutes,
              maxReprints: settings.max_reprints,
              maintenanceMessage: settings.maintenance_message ?? "",
            }}
          />
        )}
      </div>
    </main>
  );
}
