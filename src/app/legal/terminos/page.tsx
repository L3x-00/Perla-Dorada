import type { Metadata } from "next";

import {
  LegalDocument,
  LegalList,
  LegalSection,
} from "../legal-document";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de uso del sitio web de Joyería Perla Dorada.",
};

export default function TerminosPage() {
  return (
    <LegalDocument
      title="Términos y condiciones"
      updatedAt="23 de julio de 2026"
      intro={`Estos términos regulan el uso de este sitio web y de los servicios que ofrece ${brand.name}. Al utilizarlo, aceptas lo aquí descrito.`}
    >
      <LegalSection title="1. Sobre este sitio">
        <p>
          Este sitio presenta la marca {brand.name} y permite participar en los
          sorteos que organizamos. No es una tienda en línea: no se realizan
          compras de joyería a través de la web.
        </p>
      </LegalSection>

      <LegalSection title="2. Uso permitido">
        <LegalList
          items={[
            "Utilizar el sitio con fines lícitos y personales.",
            "Entregar información veraz, completa y actualizada en los formularios.",
            "No intentar acceder a áreas restringidas, ni interferir con el funcionamiento del servicio.",
            "No automatizar consultas ni registros masivos.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Participación en sorteos">
        <p>
          La participación se rige por las bases del sorteo vigente, que forman
          parte integrante de estos términos. En caso de discrepancia sobre la
          mecánica del sorteo, prevalecen las bases.
        </p>
      </LegalSection>

      <LegalSection title="4. Pagos">
        <p>
          Los pagos se realizan por Yape a la cuenta indicada en el sitio y son
          verificados manualmente por nuestro equipo. Es responsabilidad del
          participante transferir el monto exacto y adjuntar un comprobante
          legible.
        </p>
        <p>
          No solicitamos claves, códigos de verificación ni datos de tarjetas
          por ningún medio. Desconfía de cualquier mensaje que lo haga.
        </p>
      </LegalSection>

      <LegalSection title="5. Código de seguimiento">
        <p>
          Al registrar una solicitud se entrega un código de seguimiento que,
          junto con el DNI, permite consultar su estado y descargar los boletos
          aprobados. Es responsabilidad del participante conservarlo y no
          compartirlo.
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilidad del servicio">
        <p>
          Procuramos mantener el sitio disponible de forma continua, pero puede
          interrumpirse por mantenimiento o causas ajenas a nuestro control. No
          garantizamos disponibilidad ininterrumpida.
        </p>
      </LegalSection>

      <LegalSection title="7. Propiedad intelectual">
        <p>
          Las marcas, textos, fotografías y demás contenidos del sitio pertenecen
          a {brand.legal.businessName || brand.name} o se usan con autorización.
          No está permitida su reproducción sin consentimiento previo.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilidad">
        <p>
          No respondemos por daños derivados del uso indebido del sitio, de
          datos incorrectos entregados por el usuario, ni de fallas de terceros
          como proveedores de conectividad o servicios de pago.
        </p>
      </LegalSection>

      <LegalSection title="9. Modificaciones">
        <p>
          Podemos actualizar estos términos. La versión vigente es la publicada
          en esta página, con su fecha de última actualización.
        </p>
      </LegalSection>

      <LegalSection title="10. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República del Perú.
          Cualquier controversia se someterá a los jueces y tribunales
          competentes del domicilio del organizador.
        </p>
      </LegalSection>

      <LegalSection title="11. Contacto">
        <p>
          Para consultas sobre estos términos, escríbenos por los canales
          publicados en este sitio.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
