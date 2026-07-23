import "server-only";

import {
  createIpFingerprint,
  createRequestFingerprint,
} from "@/lib/security/request-fingerprint";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Separa el cubo de conteo por tipo de operación. */
  scope: string;
  /** Máximo por ventana de 15 minutos para la huella IP + User-Agent. */
  shortLimit: number;
  /** Máximo diario para la huella IP + User-Agent. */
  dailyLimit: number;
  /** Máximo por ventana de 15 minutos para la huella de IP sola. */
  ipShortLimit: number;
  /** Máximo diario para la huella de IP sola. */
  ipDailyLimit: number;
};

async function evaluate(
  fingerprint: string,
  shortLimit: number,
  dailyLimit: number,
  scope: string,
): Promise<RateLimitResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .rpc("check_rate_limit", {
      p_fingerprint_hash: fingerprint,
      p_short_limit: shortLimit,
      p_daily_limit: dailyLimit,
    })
    .single();

  if (error) {
    console.error(`No se pudo comprobar el rate limit (${scope}):`, error);

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
 * Rate limiting para endpoints públicos.
 *
 * Se evalúan DOS cubos por petición:
 *   - IP + User-Agent: límite estricto para el uso normal.
 *   - IP sola: límite más alto que impide eludir el anterior rotando el
 *     User-Agent (que es un valor bajo control del cliente).
 * Basta con que uno se exceda para bloquear.
 *
 * Lanza si la comprobación no se puede realizar: quien llama decide la
 * respuesta (los endpoints públicos responden 503, fallando en cerrado).
 */
export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const [byAgent, byIp] = await Promise.all([
    evaluate(
      createRequestFingerprint(request, options.scope),
      options.shortLimit,
      options.dailyLimit,
      options.scope,
    ),
    evaluate(
      createIpFingerprint(request, options.scope),
      options.ipShortLimit,
      options.ipDailyLimit,
      `${options.scope}:ip`,
    ),
  ]);

  return {
    allowed: byAgent.allowed && byIp.allowed,
    retryAfterSeconds: Math.max(
      byAgent.retryAfterSeconds,
      byIp.retryAfterSeconds,
    ),
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
  ipShortLimit: 60,
  ipDailyLimit: 300,
};

/*
 * Alta de solicitudes de compra: el endpoint más sensible (sube archivos y
 * reserva boletos), por eso los topes son mucho más bajos.
 */
export const PURCHASE_REQUEST_RATE_LIMIT: RateLimitOptions = {
  scope: "purchase-request",
  shortLimit: 5,
  dailyLimit: 20,
  ipShortLimit: 15,
  ipDailyLimit: 60,
};
