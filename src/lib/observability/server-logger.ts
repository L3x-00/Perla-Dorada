import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|proof|dni|document|phone|whatsapp|email|full.?name|tracking|reason/i;
const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 3;
const CONSOLE_ERROR_PATCHED = Symbol.for(
  "perla-dorada-rifas.structured-console-error",
);
const rawConsoleError = console.error.bind(console);
const rawConsoleLog = console.log.bind(console);
const rawConsoleWarn = console.warn.bind(console);

function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();

  return value === "debug" || value === "warn" || value === "error"
    ? value
    : "info";
}

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…`
    : value;
}

function redactText(value: string): string {
  return truncate(
    value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
      .replace(/(apikey|api_key|token|secret|password)=([^\s&]+)/gi, "$1=[REDACTED]"),
  );
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: redactText(value.message || "Error desconocido"),
      ...(typeof (value as Error & { digest?: unknown }).digest === "string"
        ? { digest: (value as Error & { digest: string }).digest }
        : {}),
    };
  }

  if (depth >= MAX_DEPTH) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitize(entry, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(entry, depth + 1),
      ]),
    );
  }

  return String(value);
}

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[configuredLevel()]) {
    return;
  }

  const sanitizedContext = sanitize(context);
  const safeContext =
    sanitizedContext && typeof sanitizedContext === "object"
      ? sanitizedContext
      : {};
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "perla-dorada-rifas",
    environment: process.env.NODE_ENV ?? "unknown",
    ...safeContext,
  };
  const output = JSON.stringify(entry);

  if (level === "error") {
    rawConsoleError(output);
  } else if (level === "warn") {
    rawConsoleWarn(output);
  } else {
    rawConsoleLog(output);
  }
}

export function logInfo(event: string, context?: LogContext): void {
  emit("info", event, context);
}

export function logWarn(event: string, context?: LogContext): void {
  emit("warn", event, context);
}

export function logError(
  event: string,
  error: unknown,
  context?: LogContext,
): void {
  emit("error", event, { ...context, error });
}

export function getRequestId(headers: Headers): string {
  const candidate = headers.get("x-request-id")?.trim();

  if (candidate && /^[A-Za-z0-9_-]{8,128}$/.test(candidate)) {
    return candidate;
  }

  return crypto.randomUUID();
}

export function getSafePath(value: string): string {
  try {
    return new URL(value, "https://perla-dorada.invalid").pathname;
  } catch {
    return "/unknown";
  }
}

export function installStructuredConsoleErrorLogging(): void {
  const runtime = globalThis as typeof globalThis & {
    [CONSOLE_ERROR_PATCHED]?: boolean;
  };

  if (runtime[CONSOLE_ERROR_PATCHED]) {
    return;
  }

  runtime[CONSOLE_ERROR_PATCHED] = true;
  console.error = (...arguments_: unknown[]) => {
    const [firstArgument, ...remainingArguments] = arguments_;

    logError("application.console_error", firstArgument, {
      ...(remainingArguments.length > 0
        ? { context: remainingArguments }
        : {}),
    });
  };
}
