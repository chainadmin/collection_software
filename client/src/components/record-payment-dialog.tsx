import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
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
    setPaymentDate(new Date());
    setSelectedDates([]);
    setSelectedCardId("");
    setCardType("visa");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardHolderName("");
    setCardBillingZip("");
  };

  const addSelectedDate = (date: Date | undefined) => {
    if (date && !selectedDates.some(d => d.toDateString() === date.toDateString())) {
      setSelectedDates([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const removeSelectedDate = (dateToRemove: Date) => {
    setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateToRemove.toDateString()));
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
        paymentDate: paymentDate.toISOString().split("T")[0],
        status: "pending",
        processedBy: collectorId,
        frequency: paymentFrequency,
        isRecurring,
        nextPaymentDate,
        specificDates: paymentFrequency === "specific_dates" ? selectedDates.map(d => d.toISOString().split("T")[0]).join(", ") : null,
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
          <div>
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                  data-testid="button-payment-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => date && setPaymentDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          {paymentFrequency === "specific_dates" && (
            <div>
              <Label>Future Payment Dates</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-add-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Add payment date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={addSelectedDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDates.map((date, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {format(date, "MMM d, yyyy")}
                      <button
                        type="button"
                        onClick={() => removeSelectedDate(date)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-date-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">Click to add future payment dates</p>
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
