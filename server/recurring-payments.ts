import type { Payment } from "@shared/schema";

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonthsIso(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return dateString(target);
}

/** Computes the next distinct occurrence; completed rows are never re-opened. */
export function nextRecurringOccurrence(payment: Pick<Payment, "paymentDate" | "frequency" | "isRecurring" | "specificDates">): string | null {
  if (!payment.isRecurring) return null;
  if (payment.frequency === "weekly" || payment.frequency === "bi_weekly") {
    const date = new Date(`${payment.paymentDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + (payment.frequency === "weekly" ? 7 : 14));
    return dateString(date);
  }
  if (payment.frequency === "monthly") return addMonthsIso(payment.paymentDate, 1);
  if (payment.frequency === "specific_dates") {
    return (payment.specificDates || "").split(",").map(value => value.trim())
      .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && value > payment.paymentDate)
      .sort()[0] || null;
  }
  return null;
}