import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return formatCurrency(cents);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function parseDisplayDate(dateString: string): Date {
  // A date-only value represents a calendar day, not midnight UTC. Parsing
  // YYYY-MM-DD with the Date constructor shifts that day backward for users
  // west of UTC (for example, 2026-09-11 displays as September 10 in Eastern
  // time). Preserve date-only values in the viewer's local calendar while
  // continuing to treat timestamps as actual instants.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateString);
}

export function formatDate(dateString: string): string {
  const date = parseDisplayDate(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function maskSSN(ssn: string): string {
  return `***-**-${ssn}`;
}

export function maskAccountNumber(accountNumber: string): string {
  return `****${accountNumber}`;
}

export function calculateLiquidationRate(collected: number, faceValue: number): number {
  if (faceValue === 0) return 0;
  return Math.round((collected / faceValue) * 10000) / 100;
}

// Payment statuses that never became real money -- declined, reversed,
// failed, or cancelled. Liquidation and collection-rate figures should
// count everything else (posted, pending, and any other in-flight status),
// not just payments that have already posted, since a pending arrangement
// is still real collected value for that portfolio/collector.
const NON_COLLECTIBLE_PAYMENT_STATUSES = new Set(["declined", "reversed", "failed", "cancelled"]);

export function isCollectiblePaymentStatus(status: string): boolean {
  return !NON_COLLECTIBLE_PAYMENT_STATUSES.has(status);
}
