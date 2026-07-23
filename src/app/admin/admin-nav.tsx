"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "Solicitudes", href: "/admin" },
  { label: "Rifas", href: "/admin/raffles" },
  { label: "Tickets", href: "/admin/tickets" },
  { label: "Buscar", href: "/admin/search" },
  { label: "Configuración", href: "/admin/settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  /*
   * "/admin" solo se marca activo en coincidencia exacta: si no, quedaría
   * resaltado en todas las subsecciones.
   */
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = isActive(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
              active
                ? "bg-gold-deep/20 text-gold"
                : "text-muted hover:text-cream"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
