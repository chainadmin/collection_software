export type ScheduleFrequency = "weekly" | "bi_weekly" | "monthly";
export type ScheduleRow = { amount: string; paymentDate: string };

function isoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Generates calendar dates without timezone conversion or monthly drift. */
export function generateScheduleRows(
  count: number,
  amount: string,
  frequency: ScheduleFrequency,
  firstDate: string,
): ScheduleRow[] {
  const [year, month, day] = firstDate.split("-").map(Number);
  if (!year || !month || !day || !Number.isSafeInteger(count) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    let date: Date;
    if (frequency === "monthly") {
      const targetMonth = month - 1 + index;
      const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
      date = new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay)));
    } else {
      const days = index * (frequency === "weekly" ? 7 : 14);
      date = new Date(Date.UTC(year, month - 1, day + days));
    }
    return { amount, paymentDate: isoDate(date) };
  });
}