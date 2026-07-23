import "server-only";

import { createHmac } from "node:crypto";

import { readRequiredEnv } from "@/lib/env";

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
  const secret = readRequiredEnv("RATE_LIMIT_SECRET");

  if (secret.length < 32) {
    throw new Error(
      "RATE_LIMIT_SECRET debe tener al menos 32 caracteres.",
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

/*
 * Huella basada SOLO en la IP.
 *
 * El User-Agent lo controla el atacante: rotándolo se obtenía un cubo de
 * conteo nuevo y el límite quedaba eludido. Este cubo adicional, con un
 * tope más alto, corta esa elusión sin castigar a usuarios legítimos que
 * comparten IP (NAT doméstico, operadores móviles).
 */
export function createIpFingerprint(
  request: Request,
  scope?: string,
): string {
  const secret = readRequiredEnv("RATE_LIMIT_SECRET");

  if (secret.length < 32) {
    throw new Error(
      "RATE_LIMIT_SECRET debe tener al menos 32 caracteres.",
    );
  }

  const clientIp = getClientIp(request);

  return createHmac("sha256", secret)
    .update(`ip-only\n${clientIp}\n${scope ?? ""}`)
    .digest("hex");
}