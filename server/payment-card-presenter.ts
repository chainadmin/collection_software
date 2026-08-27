import type { PaymentCard } from "@shared/schema";

/** The only card representation allowed in HTTP responses. */
export function redactPaymentCard(card: PaymentCard) {
  return {
    id: card.id,
    debtorId: card.debtorId,
    cardType: card.cardType,
    cardNumberLast4: card.cardNumberLast4,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    isDefault: card.isDefault,
    processorType: card.processorType,
    vaultStatus: card.vaultStatus,
  };
}