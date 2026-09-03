/** Browser-safe business-calendar helpers. No server/runtime dependencies. */
export function easternBusinessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Makes a local-midnight Date so react-day-picker displays the intended day. */
export function calendarDateFromYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Serializes the day a browser calendar visibly selected, never UTC instant date. */
export function localCalendarYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}