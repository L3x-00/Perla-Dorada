import type { Instrumentation } from "next";

import {
  getSafePath,
  installStructuredConsoleErrorLogging,
  logError,
  logInfo,
} from "@/lib/observability/server-logger";

export function register(): void {
  installStructuredConsoleErrorLogging();
  logInfo("service.started", {
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const requestId = request.headers["x-request-id"];

  logError("request.unhandled_error", error, {
    request_id: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    path: getSafePath(request.path),
    route: context.routePath,
    route_type: context.routeType,
    router: context.routerKind,
  });
};
