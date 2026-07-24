import { NextResponse } from "next/server";

import { PAYMENT_PROOFS_BUCKET, RAFFLE_IMAGES_BUCKET } from "@/config/storage";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/*
 * Borra una rifa completa y todo lo que cuelga de ella.
 *
 * delete_raffle (SECURITY DEFINER, valida admin) elimina las filas dentro de
 * una transacción y devuelve las rutas de Storage a limpiar (comprobantes +
 * foto del premio). Aquí se borran esos objetos: si eso falla, las filas ya
 * no existen y quedan huérfanos, que es el modo de fallo aceptado y queda en
 * el log. DESTRUCTIVO e irreversible.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonError("El identificador de la rifa no es válido.", 400);
  }

  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return jsonError("No autorizado.", 401);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("delete_raffle", {
      p_admin_user_id: adminUserId,
      p_raffle_id: id,
    })
    .single();

  if (error) {
    console.error("delete_raffle failed", {
      code: error.code,
      message: error.message,
    });

    if (error.code === "P0002") {
      return jsonError("La rifa no existe.", 404);
    }

    if (error.message.includes("ADMIN_NOT_ACTIVE")) {
      return jsonError("El administrador no está activo.", 403);
    }

    return jsonError("No se pudo eliminar la rifa.", 500);
  }

  /*
   * Limpieza de Storage tras el borrado transaccional. Se acumulan las rutas
   * que no se pudieron borrar para informarlas sin abortar: las filas ya no
   * existen, reintentar el RPC no tiene sentido.
   */
  const orphanedPaths: string[] = [];

  const proofPaths = data?.payment_proof_paths ?? [];

  if (proofPaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .remove(proofPaths);

    if (removeError) {
      console.error("No se pudieron borrar comprobantes:", removeError);
      orphanedPaths.push(...proofPaths);
    }
  }

  /* Foto del premio mayor + fotos de cada premio de la lista. */
  const raffleImagePaths = [
    data?.image_path ?? null,
    ...(data?.prize_image_paths ?? []),
  ].filter((path): path is string => Boolean(path));

  if (raffleImagePaths.length > 0) {
    const { error: imageError } = await supabase.storage
      .from(RAFFLE_IMAGES_BUCKET)
      .remove(raffleImagePaths);

    if (imageError) {
      console.error("No se pudieron borrar fotos de premios:", imageError);
      orphanedPaths.push(...raffleImagePaths);
    }
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "delete_raffle",
    entity: "raffles",
    entityId: id,
    metadata: {
      raffle_name: data?.raffle_name ?? null,
      raffle_status: data?.raffle_status ?? null,
      deleted_requests: data?.deleted_requests ?? 0,
      deleted_tickets: data?.deleted_tickets ?? 0,
      orphaned_storage_objects: orphanedPaths.length,
    },
  });

  return NextResponse.json(
    {
      success: true,
      deletedRequests: data?.deleted_requests ?? 0,
      deletedTickets: data?.deleted_tickets ?? 0,
      orphanedStorageObjects: orphanedPaths.length,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
