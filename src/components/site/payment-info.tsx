import { WhatsappIcon } from "@/components/site/icons";
import { Reveal } from "@/components/site/reveal";
import { brand, hasPaymentInfo, whatsappLink } from "@/config/brand";

/*
 * Datos de pago.
 *
 * Sin esto el participante no sabe a dónde transferir y el flujo se rompe.
 * Si aún no se configuró el Yape, se ofrece WhatsApp como alternativa para
 * coordinar el pago; si tampoco hay WhatsApp, no se muestra nada (mejor
 * omitir que enseñar un bloque vacío).
 */
export function PaymentInfo() {
  const configured = hasPaymentInfo();
  const whatsapp = whatsappLink(
    "Hola, quiero participar en el sorteo. ¿Me indican cómo realizar el pago?",
  );

  if (!configured && !whatsapp) {
    return null;
  }

  return (
    <Reveal>
      <div className="rounded-2xl border border-line bg-ink-2 p-7">
        <p className="eyebrow text-gold">Cómo pagar</p>

        {configured ? (
          <>
            <div className="mt-6 grid gap-7 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="rounded-xl border border-line bg-cream p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.payment.qrImage}
                  alt="Código QR de Yape"
                  width={148}
                  height={148}
                  className="h-[148px] w-[148px] object-contain"
                />
              </div>

              <dl className="space-y-4">
                {brand.payment.holder ? (
                  <div>
                    <dt className="eyebrow text-muted">Titular</dt>
                    <dd className="mt-1.5 text-lg text-cream">
                      {brand.payment.holder}
                    </dd>
                  </div>
                ) : null}

                {brand.payment.yapeNumber ? (
                  <div>
                    <dt className="eyebrow text-muted">Yape</dt>
                    <dd className="mt-1.5 font-display text-3xl font-light tabular-nums text-gold">
                      {brand.payment.yapeNumber}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted">
              Transfiere el <strong className="text-cream">monto exacto</strong>{" "}
              y adjunta la captura del comprobante en el formulario. Los pagos
              se verifican manualmente.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Escríbenos por WhatsApp y te indicamos cómo realizar el pago para
            participar en el sorteo.
          </p>
        )}

        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-line px-6 py-3 text-sm font-medium text-cream transition-colors duration-300 hover:border-gold hover:text-gold"
          >
            <WhatsappIcon className="h-4 w-4" />
            Consultar por WhatsApp
          </a>
        ) : null}
      </div>
    </Reveal>
  );
}
