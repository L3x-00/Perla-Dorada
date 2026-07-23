import "server-only";

import {
  PURCHASE_REQUEST_RATE_LIMIT,
  checkRateLimit,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

export type { RateLimitResult };

/*
 * Límite del alta de solicitudes públicas.
 *
 * Delega en el control genérico, que evalúa a la vez el cubo IP + User-Agent
 * y el cubo de IP sola (este último impide eludir el límite rotando el
 * User-Agent). Sustituye al RPC check_purchase_request_rate_limit, cuyos
 * topes estaban fijos en SQL y solo contemplaban la primera huella.
 */
export async function checkPurchaseRequestRateLimit(
  request: Request,
): Promise<RateLimitResult> {
  return checkRateLimit(request, PURCHASE_REQUEST_RATE_LIMIT);
}
