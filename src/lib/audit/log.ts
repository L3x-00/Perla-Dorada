import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AuditEvent = {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, Json>;
};

/*
 * Registra una acción crítica en audit_log.
 *
 * La auditoría NUNCA debe hacer fallar la operación principal: cualquier
 * error se registra en logs y se ignora. No almacenar secretos, comprobantes
 * ni PII innecesaria en `metadata`.
 */
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const client = createAdminClient();

    const { error } = await client.from("audit_log").insert({
      actor_user_id: event.actorUserId,
      action: event.action,
      entity: event.entity,
      entity_id: event.entityId ?? null,
      metadata: (event.metadata ?? {}) as Json,
    });

    if (error) {
      console.error(
        `No se pudo registrar auditoría (${event.action}):`,
        error,
      );
    }
  } catch (error) {
    console.error(
      `Error inesperado registrando auditoría (${event.action}):`,
      error,
    );
  }
}
