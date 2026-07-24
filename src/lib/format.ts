/*
 * Utilidades de formato puras (sin dependencias de servidor ni de React).
 * Se pueden importar tanto en Server Components como en Client Components.
 */

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

/*
 * timeZone fijo a Lima: sin él, un Server Component (proceso en UTC) y un
 * Client Component (navegador del visitante) formatearían el mismo instante
 * a horas distintas, provocando desajustes de hidratación y fechas erróneas.
 * El negocio es peruano, así que Lima es la zona correcta para mostrar.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function formatCurrencyPEN(value: number): string {
  if (!Number.isFinite(value)) {
    return currencyFormatter.format(0);
  }

  return currencyFormatter.format(value);
}

export function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return dateTimeFormatter.format(date);
}
