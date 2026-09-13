// Las fechas de la base son strings "YYYY-MM-DD" sin hora, así que siempre
// se leen/muestran en UTC para evitar que se corran un día en zonas horarias
// negativas (ej. Argentina, UTC-3).

export function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    timeZone: "UTC",
  });
}

export function formatMonthLabel(month: string, options: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", {
    ...options,
    timeZone: "UTC",
  });
}
