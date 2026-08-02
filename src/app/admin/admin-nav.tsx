"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "Solicitudes", href: "/admin" },
  { label: "Rifas", href: "/admin/raffles" },
  { label: "Promociones", href: "/admin/promotions" },
  { label: "Tickets", href: "/admin/tickets" },
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
    /*
     * En móvil la navegación se desliza en horizontal (no envuelve a varias
     * líneas ni empuja el contenido). Los márgenes negativos + padding hacen
     * que el primer y último elemento no queden pegados al borde y que el
     * scroll llegue de canto a canto.
     */
    <nav className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max items-center gap-1">
        {LINKS.map((link) => {
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition-colors duration-200 ${
                active
                  ? "bg-gold-deep/20 text-gold"
                  : "text-muted hover:text-cream"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
