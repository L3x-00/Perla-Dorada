import "server-only";

import { createHmac } from "node:crypto";

function getClientIp(request: Request): string {
  /*
   * En Vercel, x-vercel-forwarded-for y x-forwarded-for
   * contienen la IP pública proporcionada por la plataforma.
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

export function createRequestFingerprint(
  request: Request,
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

  /*
   * La IP no se almacena ni se envía a la base.
   * Un HMAC evita ataques de diccionario simples contra
   * hashes de direcciones IPv4.
   */
  return createHmac("sha256", secret)
    .update(`${clientIp}\n${userAgent}`)
    .digest("hex");
}