import type { Metadata } from "next";

import {
  LegalDocument,
  LegalList,
  LegalSection,
} from "../legal-document";
import { brand } from "@/config/brand";
import { formatCurrencyPEN, formatDateTime } from "@/lib/format";
import {
  getActivePublicRaffle,
  type ActivePublicRaffle,
} from "@/lib/raffles/public-raffle";
import {
  MAX_PENDING_REQUESTS_PER_DOCUMENT,
  formatReservationWindow,
  getReservationMinutes,
} from "@/lib/settings/public-settings";

export const metadata: Metadata = {
  title: "Bases del sorteo",
  description:
    "Bases y condiciones de participación en los sorteos de Joyería Perla Dorada.",
};

/*
 * Sin esto, Next preselecciona render estático: la sección de vigencia y
 * premios quedaría congelada con los datos de la rifa activa al momento
 * del build, en vez de reflejar la rifa realmente vigente en cada visita.
 */
export const dynamic = "force-dynamic";

export default async function BasesPage() {
  /*
   * Un documento legal no puede dejar de verse porque la base falle: el
   * participante lo acepta al comprar y se enlaza desde el propio
   * formulario. Si la consulta no responde, las secciones que dependen de
   * datos vivos se degradan y el resto del texto se publica igual.
   */
  let activeRaffle: ActivePublicRaffle | null = null;
  let reservationMinutes: number | null = null;

  try {
    [activeRaffle, reservationMinutes] = await Promise.all([
      getActivePublicRaffle(),
      getReservationMinutes(),
    ]);
  } catch (error) {
    console.error("Error cargando datos vivos de las bases:", error);
  }

  return (
    <LegalDocument
      title="Bases del sorteo"
      updatedAt="04 de agosto de 2026"
      intro={`Estas bases regulan la participación en los sorteos organizados por ${brand.name}. Al comprar un boleto, el participante declara conocerlas y aceptarlas.`}
    >
      <LegalSection title="1. Organizador">
        <p>
          El sorteo es organizado por {brand.legal.businessName || brand.name}
          {brand.legal.ruc ? `, con RUC ${brand.legal.ruc}` : ""}
          {brand.contact.address
            ? `, domiciliada en ${brand.contact.address}${
                brand.contact.city ? `, ${brand.contact.city}` : ""
              }`
            : ""}
          . Toda comunicación oficial se realiza por los canales publicados en
          este sitio y en nuestras redes oficiales.
        </p>
      </LegalSection>

      <LegalSection title="2. Quién puede participar">
        <LegalList
          items={[
            "Personas naturales mayores de 18 años con Documento Nacional de Identidad (DNI) o Carné de Extranjería vigente.",
            "Cada solicitud se registra a nombre de un único documento, que debe coincidir con el titular del pago.",
            "No pueden participar los titulares ni el personal de la joyería, ni sus familiares hasta el segundo grado de consanguinidad.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Cómo participar">
        <p>
          La convocatoria se difunde de forma física y virtual, incluyendo
          nuestras redes sociales oficiales (TikTok, Instagram, Facebook,
          WhatsApp, YouTube). Para participar:
        </p>
        <LegalList
          items={[
            "Elegir la cantidad de boletos en el formulario del sitio web.",
            "Pagar por Yape el monto exacto correspondiente a la cantidad elegida.",
            "Completar el formulario con nombre completo, documento, teléfono y WhatsApp, adjuntando la captura del comprobante de pago.",
            "Conservar el código único de seguimiento entregado al registrar la primera solicitud.",
          ]}
        />
        <p>
          El aporte mínimo de participación equivale al valor de un boleto
          {activeRaffle
            ? ` (${formatCurrencyPEN(activeRaffle.ticketPrice)} en el sorteo vigente)`
            : ""}
          . El precio por boleto y la cantidad total se muestran en el sitio y
          son los únicos válidos: el monto total lo calcula siempre el
          sistema.
        </p>
      </LegalSection>

      <LegalSection title="4. Vigencia y premios del sorteo vigente">
        {activeRaffle ? (
          <>
            <p>
              <strong className="text-cream">{activeRaffle.name}</strong>.
              Periodo de participación: desde el{" "}
              {formatDateTime(activeRaffle.startsAt) ?? "—"} hasta el{" "}
              {formatDateTime(activeRaffle.closesAt) ?? "—"} (hora de Perú).
            </p>
            <p>
              Fecha del sorteo: {formatDateTime(activeRaffle.drawAt) ?? "—"},
              mediante transmisión en vivo por nuestras redes oficiales
              (TikTok / Facebook).
            </p>
            {activeRaffle.prizes.length > 0 ? (
              <LegalList
                items={activeRaffle.prizes.map((prize) =>
                  prize.quantity > 1
                    ? `${prize.title} (${prize.quantity} ganadores)`
                    : prize.title,
                )}
              />
            ) : null}
          </>
        ) : (
          <p>
            En este momento no hay un sorteo activo. Cuando se abra uno
            nuevo, esta sección mostrará su periodo de participación, la
            fecha del sorteo y el detalle de premios vigente.
          </p>
        )}
      </LegalSection>

      <LegalSection title="5. Reserva y vigencia de la solicitud">
        <p>
          Al registrar una solicitud, los boletos quedan reservados por un
          tiempo limitado
          {reservationMinutes
            ? ` de ${formatReservationWindow(reservationMinutes)}`
            : ", indicado en el sitio al momento de registrarla"}
          . Si la solicitud no es validada dentro de ese plazo, la reserva
          vence automáticamente y los boletos vuelven a estar disponibles.
        </p>
        <p>
          Un mismo documento puede tener hasta{" "}
          {MAX_PENDING_REQUESTS_PER_DOCUMENT} solicitudes pendientes de
          revisión a la vez en un mismo sorteo; a partir de ahí debe esperar a
          que se revisen las anteriores para registrar una nueva.
        </p>
      </LegalSection>

      <LegalSection title="6. Validación del pago">
        <p>
          La verificación de los comprobantes es manual. Una solicitud puede ser
          rechazada, indicando el motivo, cuando el comprobante sea ilegible, el
          monto no coincida, el pago no se encuentre acreditado o los datos sean
          inconsistentes.
        </p>
        <p>
          Solo tras la aprobación se asignan los números de boleto, de forma
          correlativa y única para cada sorteo. Los números asignados no se
          modifican ni se reasignan. El sorteo se realiza de forma manual y
          supervisada, y su resultado se registra en el sistema de manera única
          e irreversible. En caso de fuerza mayor, el organizador podrá
          reprogramar la fecha, comunicándolo por los canales oficiales con la
          mayor anticipación posible.
        </p>
      </LegalSection>

      <LegalSection title="7. Ganador y entrega del premio">
        <LegalList
          items={[
            "Se determina un único ganador por cada premio, correspondiente a un número de boleto efectivamente asignado.",
            "El ganador será contactado por el teléfono o WhatsApp registrados en su solicitud.",
            "Para recibir el premio deberá presentar su documento original, que debe coincidir con el registrado en la solicitud.",
            "El premio es personal, intransferible y no canjeable por dinero en efectivo.",
          ]}
        />
        <p>
          El ganador tiene un plazo máximo de dos (2) días calendario para
          reclamar su premio contado desde el anuncio de resultados. Vencido
          ese plazo sin haber sido reclamado, el organizador podrá sortearlo
          nuevamente entre los participantes elegibles o declararlo desierto.
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
