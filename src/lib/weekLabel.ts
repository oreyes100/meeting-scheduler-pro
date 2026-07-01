// ─── Week label formatting ────────────────────────────────────────────────────
// Returns the meeting-week range as a localized string.
//
// English: "June 8-14"
// Spanish: "8-14 de junio"  (lowercase month, "de" connector, no leading zeros)
//
// Usage:
//   formatWeekRange('2026-06-08', 'es') // "8-14 de junio"
//   formatWeekRange('2026-06-08', 'en') // "June 8-14"

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatWeekRange(mondayISO: string, locale: 'en' | 'es'): string {
  const start = new Date(mondayISO + 'T00:00:00');
  if (isNaN(start.getTime())) return '';
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonthIdx = start.getMonth();
  const endMonthIdx = end.getMonth();
  if (locale === 'es') {
    if (startMonthIdx === endMonthIdx) {
      return `${startDay}-${endDay} de ${MONTHS_ES[startMonthIdx]}`;
    }
    return `${startDay} de ${MONTHS_ES[startMonthIdx]}-${endDay} de ${MONTHS_ES[endMonthIdx]}`;
  }
  // English: "June 8-14" or "May 31-June 6"
  if (startMonthIdx === endMonthIdx) {
    return `${MONTHS_EN[startMonthIdx]} ${startDay}-${endDay}`;
  }
  return `${MONTHS_EN[startMonthIdx]} ${startDay}-${MONTHS_EN[endMonthIdx]} ${endDay}`;
}
