# Assets de marca — Joyería Perla Dorada

Coloca aquí los archivos reales. **Todo lo que falte se oculta solo en la web**
(no aparecen imágenes rotas ni secciones vacías), así que puedes ir completando
poco a poco.

Los nombres de archivo importan: el código los busca exactamente así.

---

## `logo/`

| Archivo | Qué es | Formato |
|---|---|---|
| `logo-horizontal.svg` | Logo con texto, para la cabecera | SVG preferible (PNG con fondo transparente sirve) |
| `isotipo.svg` | Solo el símbolo, sin texto | SVG |
| `logo-blanco.svg` | Versión monocroma clara, para fondos oscuros | SVG |

Mientras no exista `logo-horizontal.svg`, la cabecera muestra un logotipo
tipográfico provisional hecho en código. Se ve digno, pero conviene sustituirlo
por el logo real.

**Favicon:** reemplaza `src/app/favicon.ico` (32×32 o 48×48).

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
| `yape-qr.png` | Captura del QR de Yape del negocio |

Además del QR, completa en `src/config/brand.ts` el titular y el número de Yape.
**Sin estos datos el participante no sabe a dónde pagar** y la sección de pago
no se muestra.

---

## `og/`

| Archivo | Qué es | Tamaño |
|---|---|---|
| `og.jpg` | Imagen que se ve al compartir el enlace en WhatsApp, Facebook, etc. | 1200×630 px |

Ideal: una pieza destacada sobre fondo oscuro, con el logo discreto en una esquina.

---

## `iconos/`

Solo si usas iconos propios en SVG. Los iconos de interfaz ya vienen dibujados
en código, así que esta carpeta puede quedarse vacía.

---

## Fotos del premio de cada rifa

**No van aquí.** Se suben desde el panel administrativo, en el formulario de la
rifa (`/admin/raffles`), y se guardan en Supabase Storage. Así puedes cambiar el
premio en cada sorteo sin tocar el código ni desplegar.
