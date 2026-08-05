"use client";

type QZTray = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
  };
  printers: {
    find: (name?: string) => Promise<string | string[]>;
  };
  configs: {
    create: (printer: string, options?: Record<string, unknown>) => unknown;
  };
  print: (config: unknown, data: string[]) => Promise<void>;
};

declare global {
  interface Window {
    qz?: QZTray;
  }
}

const DEFAULT_PRINTER_KEYWORD = "pos-80";

function getQZ(): QZTray {
  if (typeof window === "undefined" || !window.qz) {
    throw new Error("QZ Tray no está disponible o no está cargado.");
  }
  return window.qz;
}

export async function connectQZ(): Promise<QZTray> {
  const qz = getQZ();

  if (!qz.websocket.isActive()) {
    console.log("Conectando a QZ Tray...");
    await qz.websocket.connect();
    console.log("QZ conectado");
  }

  return qz;
}

export async function findPrinter(): Promise<string> {
  const qz = await connectQZ();

  const printers = await qz.printers.find();
  console.log("Impresoras disponibles:", printers);

  const list = Array.isArray(printers) ? printers : [printers];

  const printer = list.find((p) =>
    p.toLowerCase().includes(DEFAULT_PRINTER_KEYWORD)
  );

  if (!printer) {
    throw new Error("No se encontró impresora POS-80");
  }

  console.log("Impresora seleccionada:", printer);

  return printer;
}

export type UrnTicketPrintData = {
  ticketCode: string;
  purchasedAt: string;
  fullName: string;
  phone: string;
};

const ESC = "\x1B";
const GS = "\x1D";

function buildCommands(data: UrnTicketPrintData): string[] {
  return [
    ESC + "@",             // reset total
    ESC + "d\x00",         // 🔥 elimina espacio superior

    // ===== CÓDIGO =====
    ESC + "a\x01",         // center
    ESC + "E\x01",         // bold ON
    GS + "!\x11",          // doble tamaño

    data.ticketCode + "\n",

    // ===== RESET =====
    ESC + "@",
    ESC + "d\x00",         // 🔥 elimina espacio otra vez

    // ===== TEXTO NORMAL MEJORADO =====
    ESC + "a\x01",         // center
    ESC + "E\x00",         // bold OFF
    GS + "!\x01",          // 🔥 tamaño ligeramente mayor

    data.purchasedAt + "\n",
    data.fullName.toUpperCase() + "\n",
    data.phone + "\n",

    "\n",

    GS + "V\x41\x00"       // corte
  ];
}
export async function printUrnTickets(
  tickets: UrnTicketPrintData[]
): Promise<void> {
  try {
    console.log("Iniciando impresión PRO en lote");

    const qz = await connectQZ();
    const printer = await findPrinter();

    const config = qz.configs.create(printer, {
      encoding: "CP437",
    });

    // 🔥 CLAVE: acumulamos TODOS los tickets
    const allCommands: string[] = [];

    for (const ticket of tickets) {
      const commands = buildCommands(ticket);

      // cada ticket se agrega con su corte
      allCommands.push(...commands);
    }

    console.log("Enviando lote completo:", allCommands.length, "comandos");

    // 🔥 UNA SOLA LLAMADA → UN SOLO PERMISO
    await qz.print(config, allCommands);

    console.log("Impresión completa enviada");
  } catch (error) {
    console.error("Error impresión QZ:", error);
    throw error;
  }
}
