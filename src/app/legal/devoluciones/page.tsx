import type { Metadata } from "next";

import {
  LegalDocument,
  LegalList,
  LegalSection,
} from "../legal-document";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Política de devoluciones",
  description:
    "Condiciones de devolución de los boletos de sorteo de Joyería Perla Dorada.",
};

export default function DevolucionesPage() {
  return (
    <LegalDocument
      title="Política de devoluciones"
      updatedAt="23 de julio de 2026"
      intro={`Esta política aplica exclusivamente a los boletos de sorteo adquiridos a través de este sitio. No regula la compra de joyería en tienda, que se rige por sus propias condiciones de venta.`}
    >
      <LegalSection title="1. Regla general">
        <p>
          Una vez aprobada la solicitud y asignados los números de boleto, la
          participación es firme y no admite devolución. Los números asignados
          entran en el sorteo y no pueden retirarse ni reasignarse, ya que ello
          afectaría la integridad del proceso frente al resto de participantes.
        </p>
      </LegalSection>

      <LegalSection title="2. Casos en los que sí se devuelve el importe">
        <LegalList
          items={[
            "Pago duplicado: si transferiste dos veces el mismo monto por error, se devuelve el importe excedente.",
            "Monto mayor al que corresponde: se devuelve la diferencia entre lo transferido y el precio de los boletos asignados.",
            "Solicitud rechazada: si tu solicitud no es aprobada y el pago sí fue recibido, se devuelve el importe íntegro.",
            "Sorteo cancelado por el organizador: se devuelve el importe íntegro a todos los participantes con boletos asignados.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Situaciones que no generan devolución">
        <LegalList
          items={[
            "Arrepentimiento después de que la solicitud fue aprobada.",
            "No resultar ganador del sorteo.",
            "Vencimiento de la reserva sin haber realizado el pago (en ese caso no hubo cobro alguno).",
            "Datos incorrectos entregados por el participante que impidan la validación, cuando el pago no llegó a acreditarse.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Cómo solicitar una devolución">
        <p>
          Escríbenos por los canales publicados en este sitio indicando tu
          número de DNI, tu código de seguimiento y el motivo, adjuntando el
          comprobante de la transferencia.
        </p>
        <p>
          Revisaremos el caso y te daremos una respuesta en un plazo máximo de
          siete (7) días hábiles. Si corresponde la devolución, se realiza por
          el mismo medio de pago y a nombre del titular que efectuó la
          transferencia, dentro de los siete (7) días hábiles siguientes a la
          aprobación del caso.
        </p>
      </LegalSection>

      <LegalSection title="5. Reprogramación del sorteo">
        <p>
          La reprogramación de la fecha del sorteo por causas de fuerza mayor no
          genera derecho a devolución, siempre que el sorteo se realice y los
          boletos mantengan su validez.
        </p>
      </LegalSection>

      <LegalSection title="6. Contacto">
        <p>
          Para cualquier consulta sobre esta política, comunícate con{" "}
          {brand.legal.businessName || brand.name} por los canales oficiales
          publicados en este sitio.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
