/** Raw card input exists only while validating or processing an incoming request. */
export interface RawCardInput {
  pan: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
  billingZip: string;
}
