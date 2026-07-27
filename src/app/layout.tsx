import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";

import { brand } from "@/config/brand";
import "./globals.css";

/*
 * next/font descarga y auto-hospeda las tipografías en el build: no se
 * hacen peticiones a Google en tiempo de ejecución, así que la CSP
 * (font-src 'self') no las bloquea y no hay salto visual al cargar.
 */
const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display-serif",
  display: "swap",
});

const bodySans = Inter({
  subsets: ["latin"],
  variable: "--font-body-sans",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://perla-dorada.onrender.com";

/* Se aplica antes de pintar la página para evitar un destello del tema opuesto. */
const themeBootstrap = `(() => {
  try {
    const storedTheme = localStorage.getItem("perla-dorada-theme");
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand.name} · ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  icons: {
    icon: "/marca/logo/logo.webp",
    shortcut: "/marca/logo/logo.webp",
    apple: "/marca/logo/logo.webp",
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: brand.name,
    title: `${brand.name} · ${brand.tagline}`,
    description: brand.description,
    images: ["/marca/og/moto2.webp", "/marca/og/moto.webp"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`h-full antialiased ${displaySerif.variable} ${bodySans.variable}`}
    >
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body className="flex min-h-full flex-col bg-ink text-cream">
        {children}
      </body>
    </html>
  );
}
