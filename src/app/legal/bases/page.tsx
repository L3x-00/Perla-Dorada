import type { Metadata } from "next";

import {
  LegalDocument,
  LegalList,
  LegalSection,
} from "../legal-document";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Bases del sorteo",
  description:
    "Bases y condiciones de participación en los sorteos de Joyería Perla Dorada.",
};

export default function BasesPage() {
  return (
    <LegalDocument
      title="Bases del sorteo"
      updatedAt="23 de julio de 2026"
      intro={`Estas bases regulan la participación en los sorteos organizados por ${brand.name}. Al comprar un boleto, el participante declara conocerlas y aceptarlas.`}
    >
      <LegalSection title="1. Organizador">
        <p>
          El sorteo es organizado por {brand.legal.businessName || brand.name}
          {brand.legal.ruc ? `, con RUC ${brand.legal.ruc}` : ""}. Toda
          comunicación oficial se realiza por los canales publicados en este
          sitio y en nuestras redes oficiales.
        </p>
      </LegalSection>

      <LegalSection title="2. Quién puede participar">
        <LegalList
          items={[
            "Personas naturales mayores de 18 años con Documento Nacional de Identidad (DNI) vigente.",
            "Cada solicitud se registra a nombre de un único DNI, que debe coincidir con el titular del pago.",
            "No pueden participar los titulares ni el personal de la joyería, ni sus familiares directos.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Cómo participar">
        <LegalList
          items={[
            "Elegir la cantidad de boletos en el formulario del sitio web.",
            "Pagar por Yape el monto exacto correspondiente a la cantidad elegida.",
            "Completar el formulario con nombre completo, DNI, teléfono y WhatsApp, adjuntando la captura del comprobante de pago.",
            "Conservar el código único de seguimiento entregado al registrar la primera solicitud.",
          ]}
        />
        <p>
          El precio por boleto y la cantidad total de boletos se muestran en el
          sitio y son los únicos válidos. El monto total lo calcula siempre el
          sistema.
        </p>
      </LegalSection>

      <LegalSection title="4. Reserva y vigencia de la solicitud">
        <p>
          Al registrar una solicitud, los boletos quedan reservados por un
          tiempo limitado (60 minutos, salvo que se indique otro plazo en el
          sitio). Si la solicitud no es validada dentro de ese plazo, la reserva
          vence automáticamente y los boletos vuelven a estar disponibles.
        </p>
        <p>
          Solo puede existir una solicitud pendiente por DNI y sorteo a la vez.
        </p>
      </LegalSection>

      <LegalSection title="5. Validación del pago">
        <p>
          La verificación de los comprobantes es manual. Una solicitud puede ser
          rechazada, indicando el motivo, cuando el comprobante sea ilegible, el
          monto no coincida, el pago no se encuentre acreditado o los datos sean
          inconsistentes.
        </p>
        <p>
          Solo tras la aprobación se asignan los números de boleto, de forma
          correlativa y única para cada sorteo. Los números asignados no se
          modifican ni se reasignan.
        </p>
      </LegalSection>

      <LegalSection title="6. Fecha y modalidad del sorteo">
        <p>
          La fecha del sorteo es la publicada en el sitio para el sorteo
          vigente. El sorteo se realiza de forma manual y supervisada, y su
          resultado se registra en el sistema de manera única e irreversible.
        </p>
        <p>
          En caso de fuerza mayor, el organizador podrá reprogramar la fecha,
          comunicándolo por los canales oficiales con la mayor anticipación
          posible.
        </p>
      </LegalSection>

      <LegalSection title="7. Ganador y entrega del premio">
        <LegalList
          items={[
            "Se determina un único ganador por sorteo, correspondiente a un número de boleto efectivamente asignado.",
            "El ganador será contactado por el teléfono o WhatsApp registrados en su solicitud.",
            "Para recibir el premio deberá presentar su DNI original, que debe coincidir con el registrado en la solicitud.",
            "El premio es personal, no transferible y no canjeable por dinero en efectivo.",
          ]}
        />
        <p>
          Si el ganador no puede ser contactado o no reclama el premio en el
          plazo comunicado, el organizador informará el procedimiento aplicable
          por los canales oficiales.
        </p>
      </LegalSection>

      <LegalSection title="8. Descalificación">
        <p>
          Podrá descalificarse cualquier participación con datos falsos,
          comprobantes adulterados, suplantación de identidad o cualquier
          intento de manipular el sistema.
        </p>
      </LegalSection>

      <LegalSection title="9. Datos personales">
        <p>
          Los datos entregados se tratan conforme a nuestra política de
          privacidad y a la Ley N.º 29733, Ley de Protección de Datos
          Personales, y su reglamento.
        </p>
      </LegalSection>

      <LegalSection title="10. Aceptación">
        <p>
          La participación en el sorteo implica la aceptación íntegra de estas
          bases. Cualquier situación no prevista será resuelta por el
          organizador de buena fe y comunicada por los canales oficiales.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
