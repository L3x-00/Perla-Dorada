"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { btnDanger, btnGhost, btnPrimary, btnSuccess } from "@/components/admin/ui";
import { CloseIcon } from "@/components/site/icons";

type ConfirmTone = "success" | "danger" | "default";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const toneButton: Record<ConfirmTone, string> = {
  success: btnSuccess,
  danger: btnDanger,
  default: btnPrimary,
};

const toneAccent: Record<ConfirmTone, string> = {
  success: "text-emerald-300",
  danger: "text-red-300",
  default: "text-gold",
};

/*
 * Confirmación en modal, para reemplazar window.confirm() —esa caja gris del
 * navegador arriba de la ventana— por algo integrado con la marca. Un pop
 * rápido (nada de animaciones largas: esto es panel de trabajo), Escape y clic
 * fuera cancelan, y el botón de confirmar toma el color de la acción.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => {
            if (!busy) {
              onCancel();
            }
          }}
        >
          <motion.div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <h2
                className={`font-display text-xl font-light ${toneAccent[tone]}`}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                aria-label="Cerrar"
                className="rounded-full border border-line p-1.5 text-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="px-6 pt-3 text-sm leading-relaxed text-muted">
              {description}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-line bg-ink-3/40 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className={btnGhost}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={toneButton[tone]}
              >
                {busy ? "Procesando…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
