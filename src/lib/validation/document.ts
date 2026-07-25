/*
 * Documento de identidad del participante.
 *
 * Se comparte entre el formulario de compra, las consultas públicas y las
 * rutas API. Las reglas de aquí son un espejo de las que aplica
 * create_purchase_request en PostgreSQL: si cambian allí, cambian aquí.
 * La base sigue siendo la autoridad; esto solo evita viajes inútiles.
 */

export const DOCUMENT_TYPES = ["dni", "cui"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  dni: "DNI",
  cui: "CUI",
};

/** Texto de ayuda bajo el campo, según el tipo elegido. */
export const DOCUMENT_HINTS: Record<DocumentType, string> = {
  dni: "8 dígitos, sin puntos ni guiones.",
  cui: "Carné de extranjería o documento del país de origen.",
};

export const DOCUMENT_MAX_LENGTH: Record<DocumentType, number> = {
  dni: 8,
  cui: 20,
};

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" &&
    DOCUMENT_TYPES.includes(value as DocumentType)
  );
}

/**
 * Quita separadores y pasa a mayúsculas.
 * Réplica exacta de public.normalize_document_number().
 */
export function normalizeDocumentNumber(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * Devuelve el mensaje de error o `null` si el número es válido para el
 * tipo indicado. Espera el valor YA normalizado.
 */
export function validateDocumentNumber(
  documentType: DocumentType,
  normalizedNumber: string,
): string | null {
  if (documentType === "dni") {
    return /^[0-9]{8}$/.test(normalizedNumber)
      ? null
      : "El DNI debe contener 8 dígitos.";
  }

  return /^[A-Z0-9]{6,20}$/.test(normalizedNumber)
    ? null
    : "El CUI debe tener entre 6 y 20 caracteres alfanuméricos.";
}
