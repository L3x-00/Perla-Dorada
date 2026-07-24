/*
 * Datos de marca y contacto.
 *
 * ⚠️ COMPLETAR: los campos vacíos ("") se ocultan solos en la web —
 * ningún enlace roto ni sección a medias. Rellena lo que tengas y el
 * sitio irá mostrando cada bloque a medida que exista.
 */

export const brand = {
  name: "Joyería Perla Dorada",
  shortName: "Perla Dorada",
  tagline: "Joyería fina",
  description:
    "Joyería fina en oro y plata. Piezas seleccionadas para acompañar los momentos que se recuerdan.",

  /** Historia breve que aparece en la sección "Sobre nosotros". */
  about:
    "En Joyería Perla Dorada seleccionamos cada pieza con el mismo cuidado con el que se elige un regalo importante. Trabajamos con oro y plata de calidad certificada, y acompañamos a nuestros clientes desde la elección hasta el mantenimiento de su joya.",

  contact: {
    /** Solo dígitos con código de país, p. ej. "51987654321". */
    whatsapp: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  },

  social: {
    instagram: "",
    tiktok: "https://www.tiktok.com/@joyeriaperladorada12",
    facebook: "https://www.facebook.com/joyeriaperladorada0",
  },

  /** Datos de pago que ve el participante para pagar su boleto. */
  payment: {
    /** Titular tal como aparece en Yape. */
    holder: "",
    /** Número de Yape, p. ej. "987 654 321". */
    yapeNumber: "",
    /** QR de Yape en public/marca/pago/qr.webp */
    qrImage: "/marca/pago/qr.webp",
  },

  legal: {
    businessName: "",
    ruc: "",
  },
} as const;

export type SocialNetwork = keyof typeof brand.social;

/** Redes con URL configurada, listas para pintar. */
export function activeSocialLinks(): { network: SocialNetwork; url: string }[] {
  return (Object.keys(brand.social) as SocialNetwork[])
    .map((network) => ({ network, url: brand.social[network] }))
    .filter((item) => item.url.trim().length > 0);
}

export function whatsappLink(message?: string): string | null {
  const number = brand.contact.whatsapp.replace(/\D/g, "");

  if (!number) {
    return null;
  }

  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${query}`;
}

/** true cuando ya hay con qué pagar: el QR basta, aunque falte el número. */
export function hasPaymentInfo(): boolean {
  return (
    brand.payment.qrImage.trim().length > 0 ||
    brand.payment.yapeNumber.trim().length > 0 ||
    brand.payment.holder.trim().length > 0
  );
}
