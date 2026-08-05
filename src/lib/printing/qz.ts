"use client";

/*
 * Impresión directa ESC/POS vía QZ Tray, en paralelo a window.print().
 *
 * No reemplaza el flujo existente (la hoja imprimible que ya arma cada
 * página de impresión sigue siendo la vía principal, sin QZ Tray no hace
 * falta nada de esto). Esta es una vía adicional para equipos que ya
 * tienen la aplicación de escritorio QZ Tray instalada y una impresora
 * térmica configurada: evita el diálogo de impresión del navegador y sus
 * márgenes/espacios, y permite un corte exacto al final de cada ticket.
 *
 * Requiere que qz-tray.js esté cargado como <script> global (ver
 * print-controls.tsx) y que la aplicación QZ Tray esté abierta en el
 * equipo — si no lo está, connectQZ() falla con un mensaje explicando eso,
 * nunca con un error críptico.
 */

type QZCertificatePromiseExecutor = (
  resolve: (value: string | null) => void,
  reject: (reason?: unknown) => void,
) => void;

type QZSignaturePromiseFactory = (
  toSign: string,
) => (resolve: (value: string | null) => void, reject: (reason?: unknown) => void) => void;

type QZTray = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
  };
  security: {
    setCertificatePromise: (executor: QZCertificatePromiseExecutor) => void;
    setSignaturePromise: (factory: QZSignaturePromiseFactory) => void;
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

const DEFAULT_PRINTER_NAME = "POS-80-Series";

function getQZ(): QZTray {
  if (typeof window === "undefined" || !window.qz) {
    throw new Error(
      "QZ Tray no está disponible. Verifica que la aplicación QZ Tray esté abierta en este equipo y que la página haya terminado de cargar.",
    );
  }

  return window.qz;
}

let securityConfigured = false;

/*
 * Modo desarrollo: sin certificado ni firma. QZ Tray mostrará un aviso de
 * "sitio no verificado" en cada conexión hasta que se configure un
 * certificado real para producción — eso es aceptable para uso interno del
 * panel, no para distribuir a equipos fuera de control del negocio.
 */
function configureSecurity(qz: QZTray) {
  if (securityConfigured) {
    return;
  }

  qz.security.setCertificatePromise((resolve) => resolve(null));
  qz.security.setSignaturePromise(() => (resolve) => resolve(null));
  securityConfigured = true;
}

export async function connectQZ(): Promise<QZTray> {
  const qz = getQZ();
  configureSecurity(qz);

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  return qz;
}

export async function findPrinter(
  name: string = DEFAULT_PRINTER_NAME,
): Promise<string> {
  const qz = await connectQZ();
  const found = await qz.printers.find(name);
  const printerName = Array.isArray(found) ? found[0] : found;

  if (!printerName) {
    throw new Error(`No se encontró ninguna impresora que coincida con "${name}".`);
  }

  return printerName;
}

export type UrnTicketPrintData = {
  ticketCode: string;
  purchasedAt: string;
  fullName: string;
  phone: string;
};

const ESC = "\x1B";
const GS = "\x1D";

function buildEscPosCommands(data: UrnTicketPrintData): string[] {
  return [
    `${ESC}@`, // inicializa impresora
    `${ESC}a\x01`, // centra el contenido
    `${ESC}E\x01${GS}!\x11`, // negrita + tamaño doble (ancho y alto)
    `${data.ticketCode}\n`,
    `${GS}!\x00${ESC}E\x00`, // vuelve a tamaño y peso normal
    `${data.purchasedAt}\n`,
    `${data.fullName.toUpperCase()}\n`,
    `${data.phone}\n`,
    "\n",
    `${GS}V\x41\x00`, // corte total, sin feed extra (GS V A 0)
  ];
}

export async function printUrnTicket(
  data: UrnTicketPrintData,
  printerName?: string,
): Promise<void> {
  const qz = await connectQZ();
  const resolvedPrinterName = await findPrinter(printerName);
  const config = qz.configs.create(resolvedPrinterName);

  await qz.print(config, buildEscPosCommands(data));
}
