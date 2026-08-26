export type CardNetwork = "Visa" | "Mastercard" | "American Express" | "Discover" | "Unknown";
export type CardFunding = "Credit" | "Debit" | "Prepaid" | "Unknown";

export interface CardMetadata {
  network: CardNetwork;
  type: CardFunding;
  issuer: string;
  country: string;
  classification: "Commercial" | "Consumer" | "Unknown";
}

export interface CardValidationResult extends CardMetadata {
  status: "incomplete" | "valid" | "invalid";
  isValid: boolean;
}

const UNKNOWN: Omit<CardMetadata, "network"> = {
  type: "Unknown", issuer: "Unknown", country: "Unknown", classification: "Unknown",
};

// Provider-published test IINs only. Longest-prefix matching supports both six and
// eight digit IIN data without ever transmitting or indexing the full PAN.
const TEST_IIN_METADATA: Record<string, Omit<CardMetadata, "network">> = {
  "40000566": { type: "Debit", issuer: "Stripe test issuer", country: "US", classification: "Consumer" },
  "424242": { type: "Credit", issuer: "Stripe test issuer", country: "US", classification: "Consumer" },
};

export function normalizeCardNumber(value: string): { digits: string; malformed: boolean } {
  return { digits: value.replace(/[\s-]/g, ""), malformed: /[^\d\s-]/.test(value) };
}

export function detectCardNetwork(digits: string): CardNetwork {
  if (/^4/.test(digits)) return "Visa";
  const firstSix = Number(digits.slice(0, 6));
  if (/^5[1-5]/.test(digits) || (digits.length >= 4 && firstSix >= 222100 && firstSix <= 272099)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6011/.test(digits) || /^65/.test(digits) || /^64[4-9]/.test(digits) || (digits.length >= 6 && firstSix >= 622126 && firstSix <= 622925)) return "Discover";
  return "Unknown";
}

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double && (digit *= 2) > 9) digit -= 9;
    sum += digit;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function plausibleLength(network: CardNetwork, length: number): boolean {
  if (network === "American Express") return length === 15;
  if (network === "Mastercard") return length === 16;
  if (network === "Discover") return length === 16 || length === 19;
  if (network === "Visa") return length === 13 || length === 16 || length === 19;
  return length >= 13 && length <= 19;
}

export function lookupLocalIin(digits: string): Omit<CardMetadata, "network"> {
  const key = Object.keys(TEST_IIN_METADATA).sort((a, b) => b.length - a.length).find(prefix => digits.startsWith(prefix));
  return key ? TEST_IIN_METADATA[key] : UNKNOWN;
}

export function validateCardNumber(value: string): CardValidationResult {
  const normalized = normalizeCardNumber(value);
  const network = detectCardNetwork(normalized.digits);
  const metadata = lookupLocalIin(normalized.digits);
  if (normalized.malformed) return { status: "invalid", isValid: false, network, ...metadata };
  if (normalized.digits.length < 12) return { status: "incomplete", isValid: false, network, ...metadata };
  const isValid = plausibleLength(network, normalized.digits.length) && passesLuhn(normalized.digits);
  return { status: isValid ? "valid" : "invalid", isValid, network, ...metadata };
}

export class IinLookupCache {
  private cache = new Map<string, Omit<CardMetadata, "network">>();
  lookup(value: string) {
    const digits = normalizeCardNumber(value).digits;
    if (digits.length < 6) return UNKNOWN;
    const key = digits.slice(0, Math.min(8, digits.length));
    if (!this.cache.has(key)) this.cache.set(key, lookupLocalIin(key));
    return this.cache.get(key)!;
  }
  get size() { return this.cache.size; }
}
