"use client";

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
    throw new Error("QZ Tray no está disponible.");
  }
  return window.qz;
}

let securityConfigured = false;

function configureSecurity(qz: QZTray) {
  if (securityConfigured) return;

  console.log("SECURITY: configurando seguridad QZ");

  qz.security.setCertificatePromise((resolve) => resolve(null));

  qz.security.setSignaturePromise((toSign) => {
    return (resolve) => resolve(null);
  });

  securityConfigured = true;
}

export async function connectQZ(): Promise<QZTray> {
  console.log("STEP 1: obteniendo QZ");

  const qz = getQZ();
  configureSecurity(qz);

  if (!qz.websocket.isActive()) {
    console.log("STEP 2: conectando websocket QZ");
    await qz.websocket.connect();
  } else {
    console.log("STEP 2: websocket ya activo");
  }

  return qz;
}

export async function findPrinter(
  name: string = DEFAULT_PRINTER_NAME,
): Promise<string> {
  console.log("STEP 3: buscando impresora...");

  const qz = await connectQZ();

  const printers = await qz.printers.find();
  console.log("IMPRESORAS DISPONIBLES:", printers);

  const list = Array.isArray(printers) ? printers : [printers];

  const printerName = list.find((p) =>
    p.toLowerCase().includes("pos-80")
  );

  if (!printerName) {
    throw new Error("No se encontró la impresora POS-80");
  }

  console.log("STEP 4: impresora encontrada:", printerName);

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
  console.log("STEP 5: construyendo comandos ESC/POS");

  return [
    `${ESC}@`,
    `${ESC}a\x01`,
    `${ESC}E\x01${GS}!\x11`,
    `${data.ticketCode}\n`,
    `${GS}!\x00${ESC}E\x00`,
    `${data.purchasedAt}\n`,
    `${data.fullName.toUpperCase()}\n`,
    `${data.phone}\n`,
    "\n",
    `${GS}V\x41\x00`,
  ];
}

export async function printUrnTicket(
  data: UrnTicketPrintData,
  printerName?: string,
): Promise<void> {
  try {
    console.log("STEP 0: iniciando impresión");

    const qz = await connectQZ();

    const resolvedPrinterName = await findPrinter(printerName);

    console.log("STEP 6: creando configuración");

    const config = qz.configs.create(resolvedPrinterName, {
      encoding: "CP437",
    });

    const commands = buildEscPosCommands(data);

    console.log("STEP 7: enviando a imprimir", commands);

    await qz.print(config, commands);

    console.log("STEP 8: impresión enviada correctamente");
  } catch (error) {
    console.error("ERROR EN IMPRESIÓN QZ:", error);
    throw error;
  }
}
