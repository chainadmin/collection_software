import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentCard } from "@shared/schema";
import { formatCardNumber, getCardTypeFromNumber, lookupBin } from "@/lib/bin-lookup";
import { CardValidationFeedback } from "@/components/card-validation-feedback";
import {
  generateScheduleRows,
  type ScheduleFrequency,
  type ScheduleRow,
} from "@shared/payment-schedule";
import { calendarDateFromYmd, easternBusinessDate, localCalendarYmd } from "@shared/business-date";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId: string;
  debtorName: string;
  collectorId: string;
}

type ScheduleMode = "single" | "manual" | "generated";

export function RecordPaymentDialog({
  open,
  onOpenChange,
  debtorId,
  debtorName,
  collectorId,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("single");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([
    { amount: "", paymentDate: easternBusinessDate() },
    { amount: "", paymentDate: easternBusinessDate() },
  ]);
  const [generatedCount, setGeneratedCount] = useState("2");
  const [generatedAmount, setGeneratedAmount] = useState("");
  const [generatedFrequency, setGeneratedFrequency] = useState<ScheduleFrequency>("monthly");
  const [generatedFirstDate, setGeneratedFirstDate] = useState(easternBusinessDate);
  const [arrangementId, setArrangementId] = useState(() => crypto.randomUUID());
  const [singleSubmissionId, setSingleSubmissionId] = useState(() => crypto.randomUUID());
  const [paymentMethod, setPaymentMethod] = useState("ach");
  const [cardPaymentTiming, setCardPaymentTiming] = useState<"pay_now" | "schedule_future">("pay_now");
  const [paymentFrequency, setPaymentFrequency] = useState("one_time");
  const [paymentDate, setPaymentDate] = useState<Date>(() => calendarDateFromYmd(easternBusinessDate()));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [cardType, setCardType] = useState("visa");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardBillingZip, setCardBillingZip] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardValidation = cardNumber ? lookupBin(cardNumber) : null;

  const { data: paymentCards } = useQuery<PaymentCard[]>({
    queryKey: ["/api/debtors", debtorId, "cards"],
    enabled: !!debtorId && open,
  });
  const { data: debtor } = useQuery<{ currentBalance: number }>({
    queryKey: ["/api/debtors", debtorId],
    enabled: !!debtorId && open,
  });

  const resetForm = () => {
    setPaymentAmount("");
    setScheduleMode("single");
    setScheduleRows([
      { amount: "", paymentDate: easternBusinessDate() },
      { amount: "", paymentDate: easternBusinessDate() },
    ]);
    setArrangementId(crypto.randomUUID());
    setSingleSubmissionId(crypto.randomUUID());
    setPaymentMethod("ach");
    setCardPaymentTiming("pay_now");
    setPaymentFrequency("one_time");
    setPaymentDate(calendarDateFromYmd(easternBusinessDate()));
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
    if (!debtorId || !collectorId) return;
    const activeRows = scheduleMode === "single"
      ? [{ amount: paymentAmount, paymentDate: localCalendarYmd(paymentDate) }]
      : scheduleRows;
    const rows = activeRows.map(row => ({
      amount: Math.round(Number(row.amount) * 100),
      paymentDate: row.paymentDate,
    }));
    if (rows.length === 0 || rows.some(row => !Number.isSafeInteger(row.amount) || row.amount <= 0 || !row.paymentDate)) {
      toast({ title: "Error", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    if (debtor && total > debtor.currentBalance) {
      toast({ title: "Total exceeds balance", description: "Reduce the scheduled total before continuing.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let cardIdToUse = selectedCardId;

    try {
      const paymentDateValue = localCalendarYmd(paymentDate);
      const today = easternBusinessDate();
      const shouldProcessNow = scheduleMode === "single" && paymentMethod === "card" && cardPaymentTiming === "pay_now";
      if (scheduleMode === "single" && paymentMethod === "card" && cardPaymentTiming === "schedule_future" && paymentDateValue <= today) {
        toast({ title: "Choose a future date", description: "Scheduled card payments must be dated after today.", variant: "destructive" });
        return;
      }

      if (paymentMethod === "card" && (!selectedCardId || selectedCardId === "") && cardNumber) {
        if (!cardValidation?.isValid) {
          toast({ title: "Error", description: "Please check the card number.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const [expiryMonth, expiryYear] = cardExpiry.split("/");
        if (!expiryMonth || !expiryYear) {
          toast({ title: "Error", description: "Please enter expiry in MM/YY format.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const cardRequestKey = scheduleMode === "single"
          ? `single-card:${singleSubmissionId}`
          : `arrangement-card:${arrangementId}`;
        const newCardResponse = await apiRequest("POST", `/api/debtors/${debtorId}/cards`, {
          debtorId,
          cardType,
          cardNumber,
          cardNumberLast4: cardNumber.replace(/\D/g, "").slice(-4),
          expiryMonth,
          expiryYear: `20${expiryYear}`,
          cardholderName: cardHolderName,
          billingZip: cardBillingZip,
          cvv: cardCvv,
          idempotencyKey: cardRequestKey,
        }, { headers: { "Idempotency-Key": cardRequestKey } });
        const newCard = await newCardResponse.json() as { id: string };
        cardIdToUse = newCard.id;
        // If the later arrangement request fails, a user retry reuses this
        // already-vaulted card instead of posting the PAN a second time.
        setSelectedCardId(newCard.id);
        queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "cards"] });
      }

      if (scheduleMode !== "single") {
        await apiRequest("POST", `/api/debtors/${debtorId}/payment-arrangements`, {
          arrangementId,
          paymentMethod,
          cardId: cardIdToUse || null,
          rows,
        }, { headers: { "Idempotency-Key": arrangementId } });
        queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/recent"] });
        toast({ title: "Payments scheduled", description: `${rows.length} pending payments were saved. No payment was taken today.` });
        resetForm();
        onOpenChange(false);
        return;
      }

      const amount = rows[0].amount;
      const isRecurring = paymentFrequency !== "one_time";
      let nextPaymentDate = null;
      if (isRecurring && paymentFrequency !== "specific_dates") {
        const nextDate = calendarDateFromYmd(easternBusinessDate());
        if (paymentFrequency === "weekly") nextDate.setDate(nextDate.getDate() + 7);
        else if (paymentFrequency === "bi_weekly") nextDate.setDate(nextDate.getDate() + 14);
        else if (paymentFrequency === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        nextPaymentDate = localCalendarYmd(nextDate);
      }

      const paymentResponse = await apiRequest("POST", `/api/debtors/${debtorId}/payments`, {
        debtorId,
        amount,
        paymentMethod,
        paymentDate: shouldProcessNow ? today : paymentDateValue,
        status: "pending",
        processedBy: collectorId,
        frequency: paymentFrequency,
        isRecurring,
        nextPaymentDate,
        specificDates: paymentFrequency === "specific_dates" ? selectedDates.map(localCalendarYmd).join(", ") : null,
        cardId: cardIdToUse || null,
        processNow: shouldProcessNow,
        idempotencyKey: singleSubmissionId,
      }, { headers: { "Idempotency-Key": singleSubmissionId } });
      const processedPayment = await paymentResponse.json() as { status?: string; declineReason?: string | null };

      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/recent"] });

      if (shouldProcessNow) {
        const approved = processedPayment?.status === "processed" || processedPayment?.status === "posted";
        toast({
          title: approved ? "Payment approved" : "Payment declined",
          description: approved ? "The card was saved for future payments." : (processedPayment?.declineReason || "The card payment was not approved."),
          variant: approved ? "default" : "destructive",
        });
      } else {
        toast({ title: "Payment scheduled", description: "No payment was taken today." });
      }
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Payment could not be recorded",
        description: error instanceof Error ? error.message : "Failed to record payment.",
        variant: "destructive",
      });
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
            <Label>Schedule Type</Label>
            <Select value={scheduleMode} onValueChange={(value) => setScheduleMode(value as ScheduleMode)}>
              <SelectTrigger data-testid="select-schedule-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single payment</SelectItem>
                <SelectItem value="manual">Multiple payments — enter manually</SelectItem>
                <SelectItem value="generated">Multiple payments — generate schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scheduleMode === "single" && (
            <div>
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
              <p className="mt-1 text-sm font-medium">
                Total: {(Number(paymentAmount) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                {debtor && ` of ${(debtor.currentBalance / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} balance`}
              </p>
            </div>
          )}
          {scheduleMode === "generated" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Number of payments</Label>
                  <Input type="number" min="2" max="60" value={generatedCount} onChange={e => setGeneratedCount(e.target.value)} />
                </div>
                <div>
                  <Label>Amount each ($)</Label>
                  <Input type="number" min="0.01" step="0.01" value={generatedAmount} onChange={e => setGeneratedAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={generatedFrequency} onValueChange={value => setGeneratedFrequency(value as ScheduleFrequency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>First date</Label>
                  <Input type="date" value={generatedFirstDate} onChange={e => setGeneratedFirstDate(e.target.value)} />
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setScheduleRows(generateScheduleRows(
                  Math.min(60, Math.max(0, Number(generatedCount))),
                  generatedAmount,
                  generatedFrequency,
                  generatedFirstDate,
                ))}
              >
                Generate Preview
              </Button>
            </div>
          )}
          {scheduleMode !== "single" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{scheduleMode === "generated" ? "Schedule preview" : "Payments"}</Label>
                {scheduleMode === "manual" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setScheduleRows(rows => [
                    ...rows,
                    { amount: "", paymentDate: easternBusinessDate() },
                  ])}>
                    <Plus className="mr-1 h-4 w-4" /> Add payment
                  </Button>
                )}
              </div>
              {scheduleRows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <div>
                    <Label className="text-xs">Amount ($)</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.amount}
                      onChange={e => setScheduleRows(rows => rows.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={row.paymentDate}
                      onChange={e => setScheduleRows(rows => rows.map((item, i) => i === index ? { ...item, paymentDate: e.target.value } : item))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove payment ${index + 1}`}
                    onClick={() => setScheduleRows(rows => rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-sm font-medium">
                Total: {(scheduleRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                {debtor && ` of ${(debtor.currentBalance / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} balance`}
              </p>
            </div>
          )}
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
              {scheduleMode === "single" && <div>
                <Label>Payment Timing</Label>
                <RadioGroup
                  value={cardPaymentTiming}
                  onValueChange={(value) => setCardPaymentTiming(value as "pay_now" | "schedule_future")}
                  className="mt-2 grid grid-cols-2 gap-3"
                >
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal">
                    <RadioGroupItem value="pay_now" data-testid="radio-pay-now" />
                    Pay Now
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal">
                    <RadioGroupItem value="schedule_future" data-testid="radio-schedule-future" />
                    Schedule for Future
                  </Label>
                </RadioGroup>
              </div>}
              {paymentCards && paymentCards.length > 0 && (
                <div>
                  <Label>Use Saved Card (Optional)</Label>
                  <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                    <SelectTrigger data-testid="select-saved-card">
                      <SelectValue placeholder="Enter new card below or select saved" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Enter New Card</SelectItem>
                      {paymentCards.filter(card => card.vaultStatus === "vaulted" && !!card.processorType && !!card.merchantId).map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.cardType.toUpperCase()} •••• {card.cardNumberLast4} (Exp: {card.expiryMonth}/{card.expiryYear})
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
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        setCardNumber(formatted);
                        const detected = getCardTypeFromNumber(formatted);
                        if (detected !== "unknown") setCardType(detected);
                      }}
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={23}
                      data-testid="input-card-number"
                    />
                    {cardValidation && <CardValidationFeedback result={cardValidation} />}
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
                    <Label>Billing ZIP</Label>
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
          {scheduleMode === "single" && <div>
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
          </div>}
          {scheduleMode === "single" && <div>
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
          </div>}
          {scheduleMode === "single" && paymentFrequency === "specific_dates" && (
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
                    disabled={(date) => localCalendarYmd(date) < easternBusinessDate()}
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
            disabled={isSubmitting || (scheduleMode === "single" ? !paymentAmount : scheduleRows.length < 2)}
            data-testid="button-confirm-payment"
          >
            {isSubmitting
              ? (scheduleMode === "single" && paymentMethod === "card" && cardPaymentTiming === "pay_now" ? "Processing..." : "Saving...")
              : (scheduleMode === "single" && paymentMethod === "card" && cardPaymentTiming === "pay_now" ? "Pay Now" : scheduleMode === "single" ? "Schedule Payment" : "Schedule Payments")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
