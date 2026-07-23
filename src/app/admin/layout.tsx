import Link from "next/link";

import { AdminNav } from "./admin-nav";
import { Wordmark } from "@/components/site/wordmark";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-ink text-cream">
      {/* La cabecera se oculta al imprimir: la vista de ticket va a papel. */}
      <header className="border-b border-line bg-ink-2 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <Link href="/admin" aria-label="Panel administrativo">
              <Wordmark />
            </Link>
            <span className="hidden h-8 w-px bg-line lg:block" />
            <span className="eyebrow hidden text-muted lg:block">Panel</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <AdminNav />
            <Link
              href="/"
              target="_blank"
              className="text-sm text-muted transition-colors hover:text-gold"
            >
              Ver sitio ↗
            </Link>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
