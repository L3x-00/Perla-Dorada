import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/*
 * La cabecera y el pie se ocultan al imprimir: esta rama incluye la
 * descarga de boletos, y el documento impreso debe salir limpio.
 */
export default function SeguimientoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main className="flex-1">{children}</main>

      <div className="print:hidden">
        <SiteFooter />
      </div>
    </>
  );
}
