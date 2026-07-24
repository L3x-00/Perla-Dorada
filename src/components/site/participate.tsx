"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowRightIcon, CloseIcon } from "@/components/site/icons";
import { PurchaseWizard } from "@/components/site/purchase-wizard";

type ParticipateProps = {
  ticketPrice: number;
  available: number;
  raffleName: string;
};

/*
 * Botón "Participar" + asistente a pantalla completa.
 *
 * El formulario ya no vive incrustado en la sección: el botón abre un modal
 * que toma la pantalla y guía la participación en 3 pasos. Al terminar (o
 * cerrar), se refresca la ruta para que la disponibilidad de boletos se
 * actualice en la portada.
 */
export function Participate({
  ticketPrice,
  available,
  raffleName,
}: ParticipateProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);

  // Ref, no estado: `close` debe ver el valor más reciente sin recrearse.
  const completedRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);

    // Si se registró una solicitud, refrescamos para actualizar el conteo.
    if (completedRef.current) {
      router.refresh();
      completedRef.current = false;
    }
  }, [router]);

  // Bloqueo del scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2.5 rounded-full bg-gold px-8 py-4 text-sm font-medium text-ink transition-colors duration-300 hover:bg-gold-soft"
      >
        Participar
        <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center sm:p-6"
          >
            <motion.div
              key="panel"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative my-auto w-full max-w-3xl rounded-2xl border border-line bg-ink-2 p-6 shadow-2xl sm:p-9"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow text-muted">Participar en</p>
                  <p className="mt-1 font-display text-lg font-light text-cream">
                    {raffleName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="shrink-0 rounded-full border border-line p-2 text-muted transition-colors duration-300 hover:border-gold hover:text-gold"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <PurchaseWizard
                ticketPrice={ticketPrice}
                available={available}
                onSuccess={() => {
                  completedRef.current = true;
                }}
                onFinished={close}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
