import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/*
 * El cliente del navegador (login administrativo) llama a Supabase, por lo
 * que su origen debe permitirse en connect-src. Se incluye también el
 * equivalente wss:// por si en el futuro se usa Realtime.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWsUrl = supabaseUrl.replace(/^https:/, "wss:");

const connectSrc = ["'self'", supabaseUrl, supabaseWsUrl]
  .filter(Boolean)
  .join(" ");

/*
 * Next.js inyecta scripts y estilos en línea para la hidratación, por eso
 * se permite 'unsafe-inline'. En desarrollo, Fast Refresh necesita además
 * 'unsafe-eval'; en producción no se concede.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
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
