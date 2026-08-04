import type { Metadata } from "next";

import {
  LegalDocument,
  LegalList,
  LegalSection,
} from "../legal-document";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo Joyería Perla Dorada trata los datos personales de quienes participan en sus sorteos.",
};

export default function PrivacidadPage() {
  return (
    <LegalDocument
      title="Política de privacidad"
      updatedAt="04 de agosto de 2026"
      intro={`En ${brand.name} tratamos los datos personales conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento. Aquí explicamos qué recogemos, para qué y por cuánto tiempo.`}
    >
      <LegalSection title="1. Responsable del tratamiento">
        <p>
          {brand.legal.businessName || brand.name}
          {brand.legal.ruc ? `, RUC ${brand.legal.ruc}` : ""}
          {brand.contact.address
            ? `, con domicilio en ${brand.contact.address}`
            : ""}
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Datos que recogemos">
        <LegalList
          items={[
            "Nombre completo y número de DNI.",
            "Teléfono y número de WhatsApp.",
            "Comprobante de pago (imagen) que adjuntas al registrar tu solicitud.",
            "Datos técnicos mínimos de la solicitud (fecha, estado, código de seguimiento y números de boleto asignados).",
          ]}
        />
        <p>
          Para prevenir abusos registramos también una huella técnica derivada
          de tu conexión. No almacenamos tu dirección IP en claro: se guarda
          únicamente un valor cifrado que no permite reconstruirla.
        </p>
      </LegalSection>

      <LegalSection title="3. Para qué usamos tus datos">
        <LegalList
          items={[
            "Verificar tu pago y validar tu solicitud de participación.",
            "Asignarte los números de boleto y emitir tu comprobante de participación.",
            "Contactarte si resultas ganador o si necesitamos aclarar algo de tu solicitud.",
            "Cumplir obligaciones legales y contables.",
            "Prevenir fraudes y usos abusivos del servicio.",
          ]}
        />
        <p>
          No vendemos ni cedemos tus datos con fines comerciales a terceros.
        </p>
        <p>
          Si resultas ganador, autorizas expresamente el uso de tu nombre en la
          publicación de resultados en nuestras redes oficiales, sin derecho a
          compensación económica adicional. Hoy publicamos ese nombre de forma
          parcial (primer nombre e inicial del apellido); no publicamos tu
          número de documento ni imágenes tuyas salvo que las compartas o
          autorices puntualmente para ese fin.
        </p>
      </LegalSection>

      <LegalSection title="4. Por cuánto tiempo los conservamos">
        <p>
          Los comprobantes de pago se eliminan de forma automática a los 15 días
          del cierre del sorteo correspondiente. Conservamos el registro de la
          solicitud, los boletos asignados y el resultado del sorteo mientras
          sea necesario para acreditar la transparencia del proceso y cumplir
          obligaciones legales.
        </p>
      </LegalSection>

      <LegalSection title="5. Con quién los compartimos">
        <p>
          Utilizamos proveedores de infraestructura tecnológica para alojar el
          sitio y la base de datos, que actúan como encargados de tratamiento y
          solo procesan la información para prestarnos el servicio. No se
          realizan otras transferencias salvo requerimiento de autoridad
          competente.
        </p>
      </LegalSection>

      <LegalSection title="6. Seguridad">
        <p>
          Los comprobantes se almacenan en un repositorio privado, accesible
          solo mediante enlaces temporales y desde el panel administrativo. El
          acceso administrativo requiere autenticación y las operaciones
          críticas quedan registradas.
        </p>
      </LegalSection>

      <LegalSection title="7. Tus derechos">
        <p>
          Puedes ejercer tus derechos de información, acceso, actualización,
          rectificación, inclusión, oposición y supresión (derechos ARCO)
          escribiéndonos por los canales publicados en este sitio, adjuntando
          copia de tu DNI para acreditar identidad.
        </p>
        <p>
          Ten en cuenta que la supresión de datos vinculados a un sorteo en
          curso puede impedir la validación de tu participación.
        </p>
      </LegalSection>

      <LegalSection title="8. Menores de edad">
        <p>
          El servicio está dirigido a mayores de 18 años. No recogemos
          deliberadamente datos de menores.
        </p>
      </LegalSection>

      <LegalSection title="9. Cambios">
        <p>
          Si modificamos esta política, publicaremos la nueva versión en esta
          misma página, indicando su fecha de actualización.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
