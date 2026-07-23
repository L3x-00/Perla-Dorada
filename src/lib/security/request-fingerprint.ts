import "server-only";

import { createHmac } from "node:crypto";

function getClientIp(request: Request): string {
  /*
   * La plataforma de hosting expone la IP pública del cliente en estos
   * encabezados (Render y Vercel usan x-forwarded-for; x-real-ip como
   * respaldo).
   */
  const forwardedIp =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");

  if (!forwardedIp) {
    return "unknown";
  }

  /*
   * Algunos proxies representan la cadena como:
   * cliente, proxy1, proxy2
   */
  return forwardedIp.split(",")[0]?.trim() || "unknown";
}

/*
 * `scope` separa los cubos de rate limiting por tipo de operación: al
 * incluirse en el HMAC, cada ámbito produce una clave distinta y no
 * consume la cuota de los demás. Sin scope el resultado es idéntico al
 * histórico (alta de solicitudes), por lo que no invalida contadores.
 */
export function createRequestFingerprint(
  request: Request,
  scope?: string,
): string {
  const secret = process.env.RATE_LIMIT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "RATE_LIMIT_SECRET no está configurado correctamente.",
    );
  }

  const clientIp = getClientIp(request);
  const userAgent =
    request.headers.get("user-agent") ?? "unknown";

  const payload = scope
    ? `${clientIp}\n${userAgent}\n${scope}`
    : `${clientIp}\n${userAgent}`;

  /*
   * La IP no se almacena ni se envía a la base.
   * Un HMAC evita ataques de diccionario simples contra
   * hashes de direcciones IPv4.
   */
  return createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}