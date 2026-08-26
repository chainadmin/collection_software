import { detectCardNetwork, normalizeCardNumber, validateCardNumber, type CardValidationResult } from "@shared/card-validation";

export type BinLookupResult = CardValidationResult;
export const lookupBin = validateCardNumber;

export function getCardTypeFromNumber(value: string): string {
  return detectCardNetwork(normalizeCardNumber(value).digits).toLowerCase().replace("american express", "amex");
}

export function formatCardNumber(value: string): string {
  const digits = normalizeCardNumber(value).digits.slice(0, 19);
  if (detectCardNetwork(digits) === "American Express") return digits.replace(/(\d{4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
