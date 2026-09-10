import type { PaymentCard } from "@shared/schema";
import { decryptCardNumber } from "./card-encryption";

/** The only card representation allowed in HTTP responses. */
export function redactPaymentCard(card: PaymentCard) {
  const cardNumber = card.encryptedCardNumber ? decryptCardNumber(card.encryptedCardNumber) : undefined;
  return {
    id: card.id,
    debtorId: card.debtorId,
    cardType: card.cardType,
    cardholderName: card.cardholderName,
    ...(cardNumber ? { cardNumber } : {}),
    cardNumberLast4: card.cardNumberLast4,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    billingZip: card.billingZip,
    isDefault: card.isDefault,
    processorType: card.processorType,
    merchantId: card.merchantId,
    vaultStatus: card.vaultStatus,
  };
}
