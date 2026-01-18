import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentCard } from "@shared/schema";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId: string;
  debtorName: string;
  collectorId: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  debtorId,
  debtorName,
  collectorId,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ach");
  const [paymentFrequency, setPaymentFrequency] = useState("one_time");
  const [specificPaymentDates, setSpecificPaymentDates] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [cardType, setCardType] = useState("visa");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardBillingZip, setCardBillingZip] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: paymentCards } = useQuery<PaymentCard[]>({
    queryKey: ["/api/debtors", debtorId, "cards"],
    enabled: !!debtorId && open,
  });

  const resetForm = () => {
    setPaymentAmount("");
    setPaymentMethod("ach");
    setPaymentFrequency("one_time");
    setSpecificPaymentDates("");
    setSelectedCardId("");
    setCardType("visa");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardHolderName("");
    setCardBillingZip("");
  };

  const handleRecordPayment = async () => {
    if (!debtorId || !paymentAmount || !collectorId) return;
    
    const amount = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let cardIdToUse = selectedCardId;

    try {
      if (paymentMethod === "card" && (!selectedCardId || selectedCardId === "") && cardNumber) {
        if (cardNumber.length < 13) {
          toast({ title: "Error", description: "Please enter a valid card number.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const [expiryMonth, expiryYear] = cardExpiry.split("/");
        if (!expiryMonth || !expiryYear) {
          toast({ title: "Error", description: "Please enter expiry in MM/YY format.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const newCard = await apiRequest("POST", `/api/debtors/${debtorId}/cards`, {
          debtorId,
          cardType,
          cardNumber,
          cardNumberLast4: cardNumber.slice(-4),
          expiryMonth,
          expiryYear: `20${expiryYear}`,
          cardholderName: cardHolderName,
          billingZip: cardBillingZip,
          cvv: cardCvv,
        }) as unknown as { id: string };
        cardIdToUse = newCard.id;
        queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "cards"] });
      }

      const isRecurring = paymentFrequency !== "one_time";
      let nextPaymentDate = null;
      if (isRecurring && paymentFrequency !== "specific_dates") {
        const today = new Date();
        if (paymentFrequency === "weekly") today.setDate(today.getDate() + 7);
        else if (paymentFrequency === "bi_weekly") today.setDate(today.getDate() + 14);
        else if (paymentFrequency === "monthly") today.setMonth(today.getMonth() + 1);
        nextPaymentDate = today.toISOString().split("T")[0];
      }

      await apiRequest("POST", `/api/debtors/${debtorId}/payments`, {
        debtorId,
        amount,
        paymentMethod,
        paymentDate: new Date().toISOString().split("T")[0],
        status: "pending",
        processedBy: collectorId,
        frequency: paymentFrequency,
        isRecurring,
        nextPaymentDate,
        specificDates: paymentFrequency === "specific_dates" ? specificPaymentDates : null,
        cardId: cardIdToUse || null,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/recent"] });

      toast({ title: "Payment recorded", description: "Payment has been added to the account." });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Record a payment for {debtorName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              data-testid="input-payment-amount"
            />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ach">ACH Transfer</SelectItem>
                <SelectItem value="card">Credit/Debit Card</SelectItem>
                <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === "card" && (
            <>
              {paymentCards && paymentCards.length > 0 && (
                <div>
                  <Label>Use Saved Card (Optional)</Label>
                  <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                    <SelectTrigger data-testid="select-saved-card">
                      <SelectValue placeholder="Enter new card below or select saved" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Enter New Card</SelectItem>
                      {paymentCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.cardType.toUpperCase()} {card.cardNumber || `**** ${card.cardNumberLast4}`} (Exp: {card.expiryMonth}/{card.expiryYear})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(!selectedCardId || selectedCardId === "") && (
                <>
                  <div>
                    <Label>Card Type</Label>
                    <Select value={cardType} onValueChange={setCardType}>
                      <SelectTrigger data-testid="select-card-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="mastercard">Mastercard</SelectItem>
                        <SelectItem value="amex">American Express</SelectItem>
                        <SelectItem value="discover">Discover</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Card Number</Label>
                    <Input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ""))}
                      maxLength={16}
                      data-testid="input-card-number"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Expiry (MM/YY)</Label>
                      <Input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                        data-testid="input-card-expiry"
                      />
                    </div>
                    <div>
                      <Label>CVV</Label>
                      <Input
                        type="text"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                        maxLength={4}
                        data-testid="input-card-cvv"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Cardholder Name</Label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={cardHolderName}
                      onChange={(e) => setCardHolderName(e.target.value)}
                      data-testid="input-cardholder-name"
                    />
                  </div>
                  <div>
                    <Label>Billing ZIP (optional)</Label>
                    <Input
                      type="text"
                      placeholder="12345"
                      value={cardBillingZip}
                      onChange={(e) => setCardBillingZip(e.target.value)}
                      maxLength={10}
                      data-testid="input-billing-zip"
                    />
                  </div>
                </>
              )}
            </>
          )}
          <div>
            <Label>Payment Frequency</Label>
            <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
              <SelectTrigger data-testid="select-payment-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-Time Payment</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="specific_dates">Specific Dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentFrequency === "specific_dates" && (
            <div>
              <Label>Specific Dates (comma separated)</Label>
              <Input
                type="text"
                placeholder="2025-02-01, 2025-02-15, 2025-03-01"
                value={specificPaymentDates}
                onChange={(e) => setSpecificPaymentDates(e.target.value)}
                data-testid="input-specific-dates"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter dates in YYYY-MM-DD format</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRecordPayment}
            disabled={isSubmitting || !paymentAmount}
            data-testid="button-confirm-payment"
          >
            {isSubmitting ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
