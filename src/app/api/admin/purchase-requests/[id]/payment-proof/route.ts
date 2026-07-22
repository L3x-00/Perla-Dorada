import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const sessionClient = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await sessionClient.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
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