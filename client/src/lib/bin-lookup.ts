export interface BinLookupResult {
  isValid: boolean;
  cardType: string | null;
  cardBrand: string | null;
  issuer: string | null;
  country: string | null;
  cardCategory: string | null;
  error?: string;
}

const BIN_RANGES = [
  { prefix: "4", length: [13, 16, 19], brand: "Visa", type: "credit/debit" },
  { prefix: "51", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "52", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "53", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "54", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "55", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "2221", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "2720", length: [16], brand: "Mastercard", type: "credit" },
  { prefix: "34", length: [15], brand: "American Express", type: "credit" },
  { prefix: "37", length: [15], brand: "American Express", type: "credit" },
  { prefix: "6011", length: [16, 19], brand: "Discover", type: "credit" },
  { prefix: "644", length: [16], brand: "Discover", type: "credit" },
  { prefix: "645", length: [16], brand: "Discover", type: "credit" },
  { prefix: "646", length: [16], brand: "Discover", type: "credit" },
  { prefix: "647", length: [16], brand: "Discover", type: "credit" },
  { prefix: "648", length: [16], brand: "Discover", type: "credit" },
  { prefix: "649", length: [16], brand: "Discover", type: "credit" },
  { prefix: "65", length: [16, 19], brand: "Discover", type: "credit" },
  { prefix: "36", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "38", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "300", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "301", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "302", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "303", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "304", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "305", length: [14], brand: "Diners Club", type: "credit" },
  { prefix: "3528", length: [16], brand: "JCB", type: "credit" },
  { prefix: "3589", length: [16], brand: "JCB", type: "credit" },
];

const ISSUER_BINS: Record<string, string> = {
  "411111": "Chase Bank",
  "401288": "Bank of America",
  "400000": "Visa Test Card",
  "492181": "Wells Fargo",
  "545454": "Capital One",
  "520000": "Mastercard Test",
  "371449": "American Express",
  "378282": "American Express",
  "601100": "Discover Test",
  "356600": "JCB Test",
};

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export function lookupBin(cardNumber: string): BinLookupResult {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (cleanNumber.length < 6) {
    return {
      isValid: false,
      cardType: null,
      cardBrand: null,
      issuer: null,
      country: null,
      cardCategory: null,
      error: "Card number too short for BIN lookup"
    };
  }

  const bin = cleanNumber.substring(0, 6);
  
  let matchedRange = null;
  for (const range of BIN_RANGES) {
    if (cleanNumber.startsWith(range.prefix)) {
      matchedRange = range;
      break;
    }
  }

  if (!matchedRange) {
    return {
      isValid: false,
      cardType: null,
      cardBrand: null,
      issuer: null,
      country: null,
      cardCategory: null,
      error: "Unknown card type - BIN not recognized"
    };
  }

  const isValidLength = matchedRange.length.includes(cleanNumber.length);
  
  if (!isValidLength && cleanNumber.length >= 13) {
    return {
      isValid: false,
      cardType: matchedRange.type,
      cardBrand: matchedRange.brand,
      issuer: ISSUER_BINS[bin] || null,
      country: "US",
      cardCategory: null,
      error: `Invalid length for ${matchedRange.brand} - expected ${matchedRange.length.join(" or ")} digits`
    };
  }

  if (cleanNumber.length >= 13 && !luhnCheck(cleanNumber)) {
    return {
      isValid: false,
      cardType: matchedRange.type,
      cardBrand: matchedRange.brand,
      issuer: ISSUER_BINS[bin] || null,
      country: "US",
      cardCategory: null,
      error: "Card number failed validation check (Luhn)"
    };
  }

  return {
    isValid: cleanNumber.length >= 13,
    cardType: matchedRange.type,
    cardBrand: matchedRange.brand,
    issuer: ISSUER_BINS[bin] || "Unknown Issuer",
    country: "US",
    cardCategory: matchedRange.brand.includes("American") ? "premium" : "standard",
    error: undefined
  };
}

export function getCardTypeFromNumber(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (cleanNumber.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  
  return 'unknown';
}

export function formatCardNumber(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  const cardType = getCardTypeFromNumber(cleanNumber);
  
  if (cardType === 'amex') {
    return cleanNumber.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3').trim();
  }
  
  return cleanNumber.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
