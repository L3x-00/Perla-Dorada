import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { readRequiredEnv } from "@/lib/env";

/*
 * Número de proxies de confianza entre el cliente e internet.
 *
 * `x-forwarded-for` es una lista `cliente, proxy1, ..., proxyN` donde cada
 * salto AÑADE al final la IP de quien se conectó a él. El propio cliente
 * puede inyectar valores al principio, así que la parte de la IZQUIERDA es
 * falsificable; solo las últimas N entradas las escribe nuestra
 * infraestructura y son de fiar. La IP real del cliente es, por tanto, la
 * que está a N posiciones desde el final.
 *
 * En Render servido directamente (*.onrender.com) hay 1 salto: su
 * balanceador, que ve la conexión real del cliente. Si algún día se pone un
 * CDN por delante (Cloudflare) o se migra a Vercel, hay que subir este
 * número mediante la variable TRUSTED_PROXY_HOPS, o el rate limit volvería a
 * ser eludible / agruparía a todos bajo la IP del CDN.
 */
function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;

  if (!raw) {
    return 1;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

/*
 * Devuelve la IP del cliente de forma NO falsificable, o "unknown".
 *
 * Antes se tomaba `x-vercel-forwarded-for` (que en Render es puro input del
 * atacante) y luego el primer elemento de `x-forwarded-for` (el más a la
 * izquierda, también controlado por el cliente). Rotando esas cabeceras se
 * obtenían infinitos cubos de conteo distintos y el rate limit no servía de
 * nada. Ahora se cuenta desde la derecha, saltando los proxies de confianza,
 * y se valida que el resultado sea una IP real.
 */
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const hops = getTrustedProxyHops();
    const candidate = parts[parts.length - hops];

    if (candidate && isIP(candidate) !== 0) {
      return candidate;
    }
  }

  /*
   * Respaldo: x-real-ip lo fija el proxy inmediato, no el cliente. Solo se
   * usa si falta x-forwarded-for y si es una IP válida.
   */
  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp && isIP(realIp) !== 0) {
    return realIp;
  }

  /*
   * Sin una IP verificable, todas las peticiones caen en el mismo cubo
   * "unknown": comparten cuota y se limitan juntas (fail-closed). Es raro y
   * seguro; nunca abre un cubo nuevo por petición.
   */
  return "unknown";
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
