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
    <div className="space-y-2">
      <p className={`${siteLabelClass} text-xs font-medium uppercase tracking-wider text-muted`} id={`${groupId}-label`}>
        Documento de identidad
      </p>

      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="mb-3 inline-flex rounded-full border border-line/50 bg-ink/30 p-1"
      >
        {DOCUMENT_TYPES.map((type) => {
          const active = type === documentType;

          return (
            <label
              key={type}
              className={`cursor-pointer rounded-full px-5 py-1.5 text-xs font-medium transition-all duration-300 ${
                active
                  ? "bg-gold text-ink shadow-lg shadow-gold/20"
                  : "text-muted hover:text-cream hover:bg-ink/50"
              }`}
            >
              <input
                type="radio"
                name={groupId}
                value={type}
                checked={active}
                onChange={() => {
                  onDocumentTypeChange(type);
                  onValueChange(sanitize(type, value));
                }}
                className="sr-only"
              />
              {DOCUMENT_LABELS[type]}
            </label>
          );
        })}
      </div>

      <div className="relative">
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
          } pl-4 pr-4 transition-all duration-300 focus:border-gold focus:ring-1 focus:ring-gold/30`}
        />

        {showHint ? (
          <div className="mt-2 flex items-center gap-1.5">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 20 20" 
              fill="currentColor" 
              className="h-3.5 w-3.5 text-muted/60"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-muted/70">
              {DOCUMENT_HINTS[documentType]}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}