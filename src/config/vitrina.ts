/*
 * Vitrina de piezas de la joyería.
 *
 * ⚠️ COMPLETAR: mientras esta lista esté vacía, la sección "Colección" no
 * se muestra (mejor omitirla que enseñar marcos vacíos).
 *
 * Para activarla:
 *   1. Coloca las fotos en public/marca/vitrina/
 *   2. Descomenta y ajusta las entradas de abajo.
 *
 * El texto `alt` describe la pieza para lectores de pantalla y buscadores:
 * escribe algo real ("Collar de oro de 18k con dije de perla"), no "foto 1".
 */

export type VitrinaPiece = {
  /** Nombre del archivo dentro de public/marca/vitrina/ */
  file: string;
  /** Descripción de la pieza. */
  alt: string;
};

export const vitrina: VitrinaPiece[] = [
  // { file: "pieza-01.webp", alt: "Collar de oro de 18k con dije de perla" },
  // { file: "pieza-02.webp", alt: "Anillo de compromiso en oro blanco" },
  // { file: "pieza-03.webp", alt: "Aretes de oro con circonias" },
  // { file: "pieza-04.webp", alt: "Pulsera tejida en plata 950" },
  // { file: "pieza-05.webp", alt: "Cadena de oro tejido italiano" },
  // { file: "pieza-06.webp", alt: "Juego de collar y aretes en oro" },
];

export function vitrinaImageSrc(piece: VitrinaPiece): string {
  return `/marca/vitrina/${piece.file}`;
}
