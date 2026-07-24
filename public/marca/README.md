# Assets de marca — Joyería Perla Dorada

Coloca aquí los archivos reales. **Todo lo que falte se oculta solo en la web**
(no aparecen imágenes rotas ni secciones vacías), así que puedes ir completando
poco a poco.

Los nombres de archivo importan: el código los busca exactamente así.

---

## `logo/`

| Archivo | Qué es | Formato |
|---|---|---|
| `logo.webp` | Logo completo (emblema + nombre), oro sobre transparente | WEBP con canal alfa · **presente** |

`logo.webp` se usa en el acceso administrativo, en el pie del sitio y como
favicon (`src/app/layout.tsx` → `metadata.icons`). La cabecera y el panel siguen
con el Wordmark tipográfico (`src/components/site/wordmark.tsx`): en una barra
estrecha el lockup cuadrado no se lee bien.

---

## `vitrina/`

Fotos de piezas de joyería para la sección de vitrina. **Es lo que más levanta
la percepción de calidad del sitio: sin estas fotos, se ve genérico.**

- **Cantidad:** entre 6 y 10.
- **Nombres:** `pieza-01.webp`, `pieza-02.webp`, … (numeración correlativa).
- **Formato:** `.webp` de preferencia (pesa mucho menos que JPG con igual calidad).
- **Tamaño:** lado largo de 1200–1600 px. Evita subir fotos de 5 MB del celular.
- **Recomendación de estilo:** fondo oscuro o neutro, pieza bien iluminada,
  encuadre cerrado. La coherencia entre fotos importa más que cada foto suelta.

Si prefieres JPG, cambia la extensión en `src/config/vitrina.ts`.

---

## `pago/`

| Archivo | Qué es |
|---|---|
| `qr.webp` | Captura del QR de Yape del negocio · **presente** |

Con solo el QR ya se muestra el bloque de pago. Para completarlo, agrega en
`src/config/brand.ts` el titular y el número de Yape (`payment.holder` y
`payment.yapeNumber`); mientras estén vacíos, se ocultan solos.

---

## `og/`

| Archivo | Qué es | Tamaño |
|---|---|---|
| `moto2.webp` | Afiche del premio (oro) · se comparte al enviar el enlace | vertical · **presente** |
| `moto.webp` | Afiche alterno del premio (morado) | vertical · **presente** |

Estas dos piezas son la imagen Open Graph (`src/app/layout.tsx`) y, si el sorteo
activo todavía no tiene fotos propias, la vitrina animada del premio las usa como
respaldo (`src/components/site/raffle-section.tsx`).

---

## `iconos/`

Solo si usas iconos propios en SVG. Los iconos de interfaz ya vienen dibujados
en código, así que esta carpeta puede quedarse vacía.

---

## Fotos del premio de cada rifa

**No van aquí.** Se suben desde el panel administrativo, en el formulario de la
rifa (`/admin/raffles`), y se guardan en Supabase Storage. Así puedes cambiar el
premio en cada sorteo sin tocar el código ni desplegar.
