import type { Metadata } from "next";

import { TicketsDocument } from "./tickets-document";

export const metadata: Metadata = {
  title: "Descargar tickets · Joyería Perla Dorada",
  description:
    "Descarga e imprime los tickets de tu solicitud aprobada con tu DNI y código de seguimiento.",
};

export default function TicketsPage() {
  return <TicketsDocument />;
}
