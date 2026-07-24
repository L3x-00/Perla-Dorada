/*
 * Conversión entre instantes ISO (lo que guarda la base, en UTC) y el valor
 * `YYYY-MM-DDTHH:mm` que consume un <input type="datetime-local">.
 *
 * El problema que resuelve: `new Date(naive)` y `date.getTimezoneOffset()`
 * dependen de la zona horaria del entorno donde corren. La lectura ocurre en
 * un Server Component (el proceso de Render corre en UTC) y la escritura en
 * el navegador del administrador (America/Lima). Si cada extremo usa su
 * propia zona, editar una rifa desplaza sus fechas varias horas en cada
 * guardado.
 *
 * La solución es anclar AMBOS extremos a America/Lima, que es la zona del
 * negocio (Perú, UTC-5 fijo, sin horario de verano). Así "22:00" que el
 * admin escribe se guarda y se relee siempre como las 22:00 de Lima, corra
 * donde corra el código.
 */

const LIMA_TIME_ZONE = "America/Lima";

/*
 * Hora de pared de Lima de un instante, como "YYYY-MM-DDTHH:mm:ss".
 * en-CA produce el formato de fecha ISO (YYYY-MM-DD) y horas 24h.
 */
function limaWallClock(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const lookup = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  // A medianoche, algunos entornos devuelven "24" en vez de "00".
  const hour = lookup("hour") === "24" ? "00" : lookup("hour");

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}T${hour}:${lookup(
    "minute",
  )}:${lookup("second")}`;
}

/** Instante ISO (UTC) → valor de `datetime-local` en hora de Lima. */
export function isoToLimaInput(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const instant = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    return "";
  }

  return limaWallClock(instant).slice(0, 16);
}

/**
 * Valor de `datetime-local` (hora de pared de Lima) → instante ISO (UTC).
 *
 * Deriva el desfase de Lima para ese momento con Intl en vez de restar 5 h a
 * mano, así que sigue siendo correcto aunque la definición de la zona
 * cambiara alguna vez.
 */
export function limaInputToIso(input: string): string | null {
  if (!input) {
    return null;
  }

  // Se interpreta primero como si fuera UTC para tener un instante de partida.
  const asIfUtc = new Date(`${input}:00Z`);

  if (Number.isNaN(asIfUtc.getTime())) {
    return null;
  }

  // Hora de pared de Lima que correspondería a ese instante.
  const limaForAsIfUtc = new Date(`${limaWallClock(asIfUtc)}Z`);

  // Diferencia = desfase de Lima (positivo: Lima va por detrás de UTC).
  const offsetMs = asIfUtc.getTime() - limaForAsIfUtc.getTime();

  return new Date(asIfUtc.getTime() + offsetMs).toISOString();
}
