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
      updatedAt="04 de agosto de 2026"
      intro={`Esta política aplica exclusivamente a los boletos de sorteo adquiridos a través de este sitio. No regula la compra de joyería en tienda, que se rige por sus propias condiciones de venta.`}
    >
      <LegalSection title="1. Regla general">
        <p>
          Una vez aprobada la solicitud y asignados los números de boleto, la
          participación queda firme y los números asignados no se reasignan
          ni se reutilizan. La única forma de dejar sin efecto una
          participación ya aprobada es la devolución o anulación formal de la
          compra antes de la fecha del sorteo (ver sección 2).
        </p>
      </LegalSection>

      <LegalSection title="2. Anulación por devolución de compra">
        <p>
          Si devuelves o anulas tu compra antes de la fecha del sorteo, tu
          participación queda anulada: los boletos correspondientes salen del
          sorteo y no pueden volver a asignarse a nadie más. La anulación la
          registra el organizador en el sistema a pedido tuyo, indicando el
          motivo, y aplica a todos los boletos de esa solicitud.
        </p>
        <p>
          Una vez realizado el sorteo, ningún boleto ya asignado puede
          anularse, aunque la compra que lo originó se devuelva después.
        </p>
      </LegalSection>

      <LegalSection title="3. Casos en los que sí se devuelve el importe">
        <LegalList
          items={[
            "Pago duplicado: si transferiste dos veces el mismo monto por error, se devuelve el importe excedente.",
            "Monto mayor al que corresponde: se devuelve la diferencia entre lo transferido y el precio de los boletos asignados.",
            "Solicitud rechazada: si tu solicitud no es aprobada y el pago sí fue recibido, se devuelve el importe íntegro.",
            "Anulación por devolución de compra antes del sorteo: se devuelve el importe correspondiente a los boletos anulados.",
            "Sorteo cancelado por el organizador: se devuelve el importe íntegro a todos los participantes con boletos asignados.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Situaciones que no generan devolución">
        <LegalList
          items={[
            "Simple arrepentimiento, sin una devolución o anulación formal de la compra.",
            "No resultar ganador del sorteo.",
            "Vencimiento de la reserva sin haber realizado el pago (en ese caso no hubo cobro alguno).",
            "Datos incorrectos entregados por el participante que impidan la validación, cuando el pago no llegó a acreditarse.",
            "Solicitudes de anulación recibidas después de la fecha del sorteo.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Cómo solicitar una devolución o anulación">
        <p>
          Escríbenos por los canales publicados en este sitio indicando tu
          número de documento de identidad (DNI o Carné de Extranjería), tu
          código de seguimiento y el motivo, adjuntando el comprobante de la
          transferencia.
        </p>
        <p>
          Revisaremos el caso y te daremos una respuesta en un plazo máximo de
          siete (7) días hábiles. Si corresponde la devolución, se realiza por
          el mismo medio de pago y a nombre del titular que efectuó la
          transferencia, dentro de los siete (7) días hábiles siguientes a la
          aprobación del caso.
        </p>
      </LegalSection>

      <LegalSection title="6. Reprogramación del sorteo">
        <p>
          La reprogramación de la fecha del sorteo por causas de fuerza mayor no
          genera derecho a devolución, siempre que el sorteo se realice y los
          boletos mantengan su validez.
        </p>
      </LegalSection>

      <LegalSection title="7. Contacto">
        <p>
          Para cualquier consulta sobre esta política, comunícate con{" "}
          {brand.legal.businessName || brand.name} por los canales oficiales
          publicados en este sitio.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
