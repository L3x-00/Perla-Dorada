"use client";

import {
  siteInputClass,
  siteLabelClass,
} from "@/components/site/form-controls";
import {
  DOCUMENT_HINTS,
  DOCUMENT_LABELS,
  DOCUMENT_MAX_LENGTH,
  DOCUMENT_TYPES,
  type DocumentType,
} from "@/lib/validation/document";

type DocumentFieldProps = {
  /** Prefijo para los id/name, porque puede haber más de uno por página. */
  idPrefix: string;
  documentType: DocumentType;
  onDocumentTypeChange: (documentType: DocumentType) => void;
  value: string;
  onValueChange: (value: string) => void;
  /** Oculta el texto de ayuda en formularios muy compactos. */
  showHint?: boolean;
};

/*
 * Sanea mientras se escribe según el tipo:
 *   DNI → solo dígitos, 8 como máximo.
 *   CUI → alfanumérico en mayúsculas, 20 como máximo.
 *
 * Es comodidad, no seguridad: la validación que manda está en Zod y en el
 * CHECK de la tabla.
 */
function sanitize(documentType: DocumentType, raw: string): string {
  const pattern = documentType === "dni" ? /[^0-9]/g : /[^0-9A-Za-z]/g;

  return raw
    .replace(pattern, "")
    .toUpperCase()
    .slice(0, DOCUMENT_MAX_LENGTH[documentType]);
}

export function DocumentField({
  idPrefix,
  documentType,
  onDocumentTypeChange,
  value,
  onValueChange,
  showHint = true,
}: DocumentFieldProps) {
  const inputId = `${idPrefix}-document-number`;
  const groupId = `${idPrefix}-document-type`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className={siteLabelClass} id={`${groupId}-label`}>
          Documento de identidad
        </p>

        <div
          role="radiogroup"
          aria-labelledby={`${groupId}-label`}
          className="inline-flex rounded-full border border-line p-0.5"
        >
          {DOCUMENT_TYPES.map((type) => {
            const active = type === documentType;

            return (
              <label
                key={type}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs transition-colors duration-300 ${
                  active
                    ? "bg-gold font-medium text-ink"
                    : "text-muted hover:text-cream"
                }`}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={type}
                  checked={active}
                  onChange={() => {
                    onDocumentTypeChange(type);
                    // Reajusta lo ya escrito al formato del nuevo tipo.
                    onValueChange(sanitize(type, value));
                  }}
                  className="sr-only"
                />
                {DOCUMENT_LABELS[type]}
              </label>
            );
          })}
        </div>
      </div>

      <label htmlFor={inputId} className="sr-only">
        Número de {DOCUMENT_LABELS[documentType]}
      </label>

      <input
        id={inputId}
        name="documentNumber"
        value={value}
        onChange={(event) =>
          onValueChange(sanitize(documentType, event.target.value))
        }
        required
        inputMode={documentType === "dni" ? "numeric" : "text"}
        maxLength={DOCUMENT_MAX_LENGTH[documentType]}
        autoComplete="off"
        placeholder={documentType === "dni" ? "12345678" : "CE123456"}
        className={`${siteInputClass} ${
          documentType === "cui" ? "uppercase" : ""
        }`}
      />

      {showHint ? (
        <p className="mt-2.5 text-xs text-muted">
          {DOCUMENT_HINTS[documentType]}
        </p>
      ) : null}
    </div>
  );
}