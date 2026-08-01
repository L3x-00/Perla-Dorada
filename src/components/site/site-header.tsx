"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/site/wordmark";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { brand } from "@/config/brand";

type NavItem = { label: string; href: string };

const NAV: NavItem[] = [
  { label: "Sorteo", href: "/#sorteo" },
  { label: "Nosotros", href: "/#nosotros" },
  { label: "Consultar", href: "/seguimiento" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  /*
   * La cabecera empieza transparente sobre el hero y solo gana fondo al
   * bajar. Evita la barra opaca permanente, que aplasta la portada.
   */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-line/40 bg-ink/35 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
        <Link href="/" aria-label={`Ir al inicio de ${brand.name}`}>
          <Wordmark inverted={!scrolled} compact />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`eyebrow transition-colors duration-300 hover:text-gold ${
                scrolled ? "text-muted" : "text-white/75"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle variant={scrolled ? "default" : "on-image"} />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          >
            <span
              className={`h-px w-6 transition-transform duration-300 ${
                scrolled ? "bg-cream" : "bg-white"
              } ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
            />
            <span
              className={`h-px w-6 transition-transform duration-300 ${
                scrolled ? "bg-cream" : "bg-white"
              } ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-line bg-ink/95 px-6 py-5 backdrop-blur-md md:hidden">
          <ul className="flex flex-col gap-5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="eyebrow text-muted transition-colors hover:text-gold"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
