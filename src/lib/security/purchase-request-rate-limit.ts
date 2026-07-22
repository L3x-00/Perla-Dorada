import "server-only";

import { createRequestFingerprint } from
  "@/lib/security/request-fingerprint";
import { createAdminClient } from
  "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkPurchaseRequestRateLimit(
  request: Request,
): Promise<RateLimitResult> {
  const fingerprint =
    createRequestFingerprint(request);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("check_purchase_request_rate_limit", {
      p_fingerprint_hash: fingerprint,
    })
    .single();

  if (error) {
    console.error(
      "No se pudo comprobar el rate limit:",
      error,
    );

    throw new Error(
      "No se pudo validar temporalmente la solicitud.",
    );
  }

  if (!data) {
    throw new Error(
      "La comprobación del límite no devolvió datos.",
    );
  }

  return {
    allowed: data.allowed,
    retryAfterSeconds:
      data.retry_after_seconds,
  };
}