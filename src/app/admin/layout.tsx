import Link from "next/link";

import { AdminNav } from "./admin-nav";
import { AdminProfileMenu } from "./admin-profile-menu";
import { Wordmark } from "@/components/site/wordmark";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-ink text-cream">
      {/*
        Cabecera fija: en pantallas largas de datos, la navegación queda
        siempre a mano. Se oculta al imprimir (la vista de ticket va a papel).
      */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink-2/95 backdrop-blur print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            {/*
              En móvil: marca y "Ver sitio" comparten una fila (justify-between)
              y la nav va debajo. En escritorio, `lg:contents` disuelve este
              envoltorio para que los tres fluyan en una sola fila: marca ·
              nav (flex-1) · salida.
            */}
            <div className="flex items-center justify-between gap-4 lg:contents">
              <Link href="/admin" aria-label="Panel administrativo">
                <Wordmark />
              </Link>

              <div className="shrink-0 lg:order-3">
                <AdminProfileMenu />
              </div>

            </div>

            {/* Navegación (deslizable en móvil, centro en escritorio) */}
            <div className="lg:order-2 lg:flex-1">
              <AdminNav />
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
