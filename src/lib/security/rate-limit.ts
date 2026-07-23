import "server-only";

import { createRequestFingerprint } from "@/lib/security/request-fingerprint";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  /** Separa el cubo de conteo por tipo de operación. */
  scope: string;
  /** Máximo de intentos por ventana de 15 minutos. */
  shortLimit: number;
  /** Máximo de intentos por día. */
  dailyLimit: number;
};

/*
 * Rate limiting genérico para endpoints públicos.
 *
 * Lanza si la comprobación no se puede realizar: quien llama decide la
 * respuesta (los endpoints públicos responden 503 y no continúan, de modo
 * que el límite falla en cerrado).
 */
export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const fingerprint = createRequestFingerprint(request, options.scope);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("check_rate_limit", {
      p_fingerprint_hash: fingerprint,
      p_short_limit: options.shortLimit,
      p_daily_limit: options.dailyLimit,
    })
    .single();

  if (error) {
    console.error(
      `No se pudo comprobar el rate limit (${options.scope}):`,
      error,
    );

    throw new Error("No se pudo validar temporalmente la solicitud.");
  }

  if (!data) {
    throw new Error("La comprobación del límite no devolvió datos.");
  }

  return {
    allowed: data.allowed,
    retryAfterSeconds: data.retry_after_seconds,
  };
}

/*
 * Consultas públicas por DNI + código de seguimiento (/api/tracking y
 * /api/tickets). Comparten ámbito para que un intento de fuerza bruta no
 * pueda alternar entre ambos endpoints para duplicar su cuota.
 */
export const PUBLIC_LOOKUP_RATE_LIMIT: RateLimitOptions = {
  scope: "public-lookup",
  shortLimit: 20,
  dailyLimit: 100,
};
