import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/*
 * El cliente del navegador (login administrativo) llama a Supabase, por lo
 * que su origen debe permitirse en connect-src. Se incluye también el
 * equivalente wss:// por si en el futuro se usa Realtime.
 */
function getAllowedOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const supabaseUrl = getAllowedOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseWsUrl = supabaseUrl
  ? supabaseUrl.replace(/^http/, "ws")
  : null;

const connectSrc = ["'self'", supabaseUrl, supabaseWsUrl]
  .filter(Boolean)
  .join(" ");

/*
 * Las fotos del premio se sirven desde el bucket público de Supabase, así
 * que su origen debe permitirse en img-src o el navegador las bloquea.
 */
const imgSrc = ["'self'", "data:", "blob:", supabaseUrl]
  .filter(Boolean)
  .join(" ");

/*
 * Next.js inyecta scripts y estilos en línea para la hidratación, por eso
 * se permite 'unsafe-inline'. En desarrollo, Fast Refresh necesita además
 * 'unsafe-eval'; en producción no se concede.
 *
 * cdn.jsdelivr.net: sirve qz-tray.js para la impresión ESC/POS directa
 * (solo se carga en las páginas de impresión administrativa). El propio
 * QZ Tray corre como aplicación local del equipo del admin y expone un
 * WebSocket en localhost; sin esos orígenes en connect-src el navegador
 * bloquea tanto el script como la conexión.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  `connect-src ${connectSrc} ws://localhost:* wss://localhost:*`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
