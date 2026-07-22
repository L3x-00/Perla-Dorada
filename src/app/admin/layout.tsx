import Link from "next/link";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <Link
            href="/admin"
            className="font-semibold"
          >
            Panel
          </Link>

          <Link
            href="/admin/raffles"
            className="text-sm text-neutral-300 hover:text-white"
          >
            Rifas
          </Link>

          <Link
            href="/admin/tickets"
            className="text-sm text-neutral-300 hover:text-white"
          >
            Tickets
          </Link>

          <Link
            href="/admin/search"
            className="text-sm text-neutral-300 hover:text-white"
          >
            Buscar
          </Link>

          <Link
            href="/admin/settings"
            className="text-sm text-neutral-300 hover:text-white"
          >
            Configuración
          </Link>
        </nav>
      </header>

      {children}
    </div>
  );
}