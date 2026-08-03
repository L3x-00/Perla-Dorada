import type { NextRequest } from "next/server";

import {
  getRequestId,
  logError,
  logInfo,
} from "@/lib/observability/server-logger";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const startedAt = performance.now();
  const requestId = getRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  try {
    const response = await updateSession(request, requestHeaders);

    response.headers.set("x-request-id", requestId);
    logInfo("http.proxy.completed", {
      request_id: requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      proxy_status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });

    return response;
  } catch (error) {
    logError("http.proxy.failed", error, {
      request_id: requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
}

export const config = {
  matcher: [
    /*
     * Ejecuta el Proxy excepto para archivos estáticos,
     * optimización de imágenes y recursos públicos.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
