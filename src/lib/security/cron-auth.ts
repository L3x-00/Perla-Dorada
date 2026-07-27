import "server-only";

import { timingSafeEqual } from "node:crypto";

import { readRequiredEnv } from "@/lib/env";

/*
 * Compara el Bearer de los cron jobs sin filtrar el secreto ni depender de
 * una comparación temprana. La diferencia temporal es muy pequeña en red,
 * pero el coste de endurecer este límite es prácticamente nulo.
 */
export function hasValidCronAuthorization(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${readRequiredEnv("CRON_SECRET")}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}
