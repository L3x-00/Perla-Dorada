import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/log";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";
const SIGNED_URL_EXPIRATION_SECONDS = 60;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "El identificador de la solicitud no es válido." },
      { status: 400 },
    );
  }

  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 },
    );
  }

  const adminClient = createAdminClient();

  const {
    data: purchaseRequest,
    error: purchaseRequestError,
  } = await adminClient
    .from("purchase_requests")
    .select(
      `
        id,
        payment_proof_path,
        payment_proof_deleted_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (purchaseRequestError) {
    console.error(
      "Error consultando el comprobante:",
      purchaseRequestError,
    );

    return NextResponse.json(
      { error: "No se pudo consultar el comprobante." },
      { status: 500 },
    );
  }

  if (!purchaseRequest) {
    return NextResponse.json(
      { error: "La solicitud no existe." },
      { status: 404 },
    );
  }

  if (purchaseRequest.payment_proof_deleted_at) {
    return NextResponse.json(
      { error: "El comprobante ya fue eliminado." },
      { status: 410 },
    );
  }

  if (!purchaseRequest.payment_proof_path) {
    return NextResponse.json(
      { error: "La solicitud no tiene un comprobante asociado." },
      { status: 404 },
    );
  }

  const {
    data: signedUrlData,
    error: signedUrlError,
  } = await adminClient.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(
      purchaseRequest.payment_proof_path,
      SIGNED_URL_EXPIRATION_SECONDS,
    );

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(
      "Error generando URL firmada:",
      signedUrlError,
    );

    return NextResponse.json(
      { error: "No se pudo abrir el comprobante." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      signedUrl: signedUrlData.signedUrl,
      expiresIn: SIGNED_URL_EXPIRATION_SECONDS,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

/*
 * Elimina el comprobante del bucket y marca payment_proof_deleted_at.
 *
 * El borrado del objeto y el marcado en la base están separados porque
 * PostgreSQL no puede tocar Storage. delete_payment_proof (SECURITY DEFINER,
 * valida admin) marca la fila y devuelve la ruta; aquí se borra el objeto.
 * Es idempotente: si la fila ya estaba marcada, se reintenta el borrado en
 * Storage sin efectos secundarios.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "El identificador de la solicitud no es válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const adminUserId = await requireActiveAdmin();

  if (!adminUserId) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .rpc("delete_payment_proof", {
      p_admin_user_id: adminUserId,
      p_request_id: id,
    })
    .single();

  if (error) {
    console.error("delete_payment_proof failed", {
      code: error.code,
      message: error.message,
    });

    const status = error.code === "P0002" ? 404 : 500;

    return NextResponse.json(
      {
        error:
          status === 404
            ? "La solicitud no existe."
            : "No se pudo eliminar el comprobante.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  /*
   * Se intenta borrar el objeto aunque la fila ya estuviera marcada
   * (already_deleted): cubre el caso de un intento anterior que marcó la
   * fila pero falló al borrar en Storage. remove() no falla si ya no existe.
   */
  if (data?.payment_proof_path) {
    const { error: removeError } = await adminClient.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .remove([data.payment_proof_path]);

    if (removeError) {
      console.error(
        "No se pudo borrar el objeto del comprobante:",
        removeError,
      );

      return NextResponse.json(
        {
          error:
            "La solicitud quedó marcada, pero no se pudo borrar la imagen del almacenamiento.",
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  await recordAuditEvent({
    actorUserId: adminUserId,
    action: "delete_payment_proof",
    entity: "purchase_requests",
    entityId: id,
    metadata: { already_deleted: data?.already_deleted ?? false },
  });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}