import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addYears, subYears } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  CalendarIcon,
  CreditCard,
  AlertCircle,
  Settings,
  Play,
  RotateCcw,
  Undo2,
  PlayCircle,
  CheckSquare,
  ArrowUpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Payment, Debtor, Merchant } from "@shared/schema";

interface PaymentWithDebtor extends Payment {
  debtor?: Debtor;
}

export default function PaymentRunner() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDebtor | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const { data: pendingPayments, isLoading: pendingLoading, refetch } = useQuery<PaymentWithDebtor[]>({
    queryKey: ["/api/payments/pending"],
  });

  const { data: allPayments } = useQuery<PaymentWithDebtor[]>({
    queryKey: ["/api/payments"],
  });

  const { data: debtors } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: merchants } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  const getDebtorName = (debtorId: string) => {
    const debtor = debtors?.find((d) => d.id === debtorId);
    return debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown";
  };

  const getDebtor = (debtorId: string) => {
    return debtors?.find((d) => d.id === debtorId);
  };

  const runSinglePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/process`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      if (data.status === "processed") {
        toast({ title: "Payment Processed", description: "Payment was successful." });
      } else if (data.status === "declined" || data.status === "failed") {
        toast({ title: "Payment Declined", description: data.declineReason || "Payment was declined.", variant: "destructive" });
      }
      setProcessingPaymentId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process payment.", variant: "destructive" });
      setProcessingPaymentId(null);
    },
  });

  const rerunPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/rerun`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      if (data.status === "processed") {
        toast({ title: "Payment Processed", description: "Re-run was successful." });
      } else if (data.status === "declined" || data.status === "failed") {
        toast({ title: "Payment Declined", description: data.declineReason || "Payment was declined again.", variant: "destructive" });
      }
      setProcessingPaymentId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to re-run payment.", variant: "destructive" });
      setProcessingPaymentId(null);
    },
  });

  const reversePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/reverse`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      toast({ title: "Payment Reversed", description: "Payment has been reversed and future payments cancelled." });
      setReverseDialogOpen(false);
      setSelectedPayment(null);
      setReverseReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reverse payment.", variant: "destructive" });
    },
  });

  const postPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/post`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      toast({ title: "Payment Posted", description: "Payment has been posted successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post payment.", variant: "destructive" });
    },
  });

  const postAllProcessedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/post-all-processed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      toast({ title: "Payments Posted", description: `${data.count} payments have been posted.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post payments.", variant: "destructive" });
    },
  });

  const handleRunSingle = (payment: PaymentWithDebtor) => {
    setProcessingPaymentId(payment.id);
    runSinglePaymentMutation.mutate(payment.id);
  };

  const handleRerun = (payment: PaymentWithDebtor) => {
    setProcessingPaymentId(payment.id);
    rerunPaymentMutation.mutate(payment.id);
  };

  const handleOpenReverse = (payment: PaymentWithDebtor) => {
    setSelectedPayment(payment);
    setReverseDialogOpen(true);
  };

  const handleConfirmReverse = () => {
    if (selectedPayment) {
      reversePaymentMutation.mutate({ paymentId: selectedPayment.id, reason: reverseReason });
    }
  };

  const filteredPayments = selectedDate
    ? pendingPayments?.filter((p) => {
        if (!p.paymentDate) return false;
        const paymentDateStr = format(new Date(p.paymentDate), "yyyy-MM-dd");
        const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
        return paymentDateStr === selectedDateStr;
      }) || []
    : pendingPayments || [];

  const todayPayments = pendingPayments?.filter((p) => {
    if (!p.paymentDate) return false;
    const paymentDateStr = format(new Date(p.paymentDate), "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return paymentDateStr === todayStr;
  }) || [];

  const pastDuePayments = pendingPayments?.filter((p) => {
    if (!p.paymentDate) return false;
    return new Date(p.paymentDate) < new Date(format(new Date(), "yyyy-MM-dd"));
  }) || [];

  const declinedPayments = allPayments?.filter((p) => p.status === "declined" || p.status === "failed") || [];
  const processedPayments = allPayments?.filter((p) => p.status === "processed") || [];
  const postedPayments = allPayments?.filter((p) => p.status === "posted") || [];
  const reversedPayments = allPayments?.filter((p) => p.status === "reversed") || [];
  
  const processedTotal = processedPayments.reduce((sum, p) => sum + p.amount, 0);
  const declinedTotal = declinedPayments.reduce((sum, p) => sum + p.amount, 0);
  const postedTotal = postedPayments.reduce((sum, p) => sum + p.amount, 0);
  const reversedTotal = reversedPayments.reduce((sum, p) => sum + p.amount, 0);

  const activeMerchants = merchants?.filter((m) => m.isActive) || [];
  const hasNMI = activeMerchants.some((m) => m.processorType === "nmi");
  const hasUSAePay = activeMerchants.some((m) => m.processorType === "usaepay");

  const totalPending = pendingPayments?.length || 0;
  const totalPendingAmount = pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  const renderPaymentActions = (payment: PaymentWithDebtor, isDeclined: boolean = false, isProcessed: boolean = false) => {
    const isProcessing = processingPaymentId === payment.id;
    const isPosting = postPaymentMutation.isPending;
    
    return (
      <div className="flex items-center gap-1">
        {isDeclined && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleRerun(payment)}
            disabled={isProcessing}
            title="Re-run payment"
            data-testid={`button-rerun-${payment.id}`}
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </Button>
        )}
        {!isDeclined && !isProcessed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleRunSingle(payment)}
            disabled={isProcessing}
            title="Run single payment"
            data-testid={`button-run-single-${payment.id}`}
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
          </Button>
        )}
        {isProcessed && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => postPaymentMutation.mutate(payment.id)}
              disabled={isPosting}
              title="Post payment"
              data-testid={`button-post-${payment.id}`}
            >
              {isPosting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenReverse(payment)}
              title="Reverse payment"
              data-testid={`button-reverse-${payment.id}`}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Payment Runner</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled payments will process automatically via merchant integrations
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className={cn(
        "border-2",
        activeMerchants.length === 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-green-500 bg-green-50 dark:bg-green-950/20"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4 flex-wrap">
            {activeMerchants.length === 0 ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Merchant Integration Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Connect NMI or USAePay in Settings to enable automatic payment processing
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/settings" data-testid="link-merchant-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Merchants
                  </a>
                </Button>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Merchant Integration Active
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {hasNMI && "NMI"}
                    {hasNMI && hasUSAePay && " and "}
                    {hasUSAePay && "USAePay"}
                    {" "}connected - payments will process automatically
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard
          title="Pending"
          value={formatCurrency(totalPendingAmount)}
          subtitle={`${totalPending} payment${totalPending !== 1 ? 's' : ''}`}
          icon={Clock}
        />
        <StatCard
          title="Processed"
          value={formatCurrency(processedTotal)}
          subtitle={`${processedPayments.length} awaiting post`}
          icon={ArrowUpCircle}
        />
        <StatCard
          title="Posted"
          value={formatCurrency(postedTotal)}
          subtitle={`${postedPayments.length} completed`}
          icon={CheckCircle}
        />
        <StatCard
          title="Declined"
          value={formatCurrency(declinedTotal)}
          subtitle={declinedPayments.length > 0 ? `${declinedPayments.length} needs re-run` : "none"}
          icon={declinedPayments.length > 0 ? XCircle : CheckCircle}
        />
        <StatCard
          title="Reversed"
          value={formatCurrency(reversedTotal)}
          subtitle={`${reversedPayments.length} reversed`}
          icon={Undo2}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 flex-wrap">
          <CardTitle className="text-lg font-medium">Pending Payments</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  data-testid="button-select-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "All dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  fromDate={subYears(new Date(), 10)}
                  toDate={addYears(new Date(), 10)}
                  defaultMonth={selectedDate || new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(undefined)}
                data-testid="button-clear-date"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredPayments.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b">
                <p className="text-sm text-muted-foreground">
                  {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
                  {selectedDate ? ` for ${format(selectedDate, "PPP")}` : " total"}
                </p>
                <p className="text-sm font-medium">
                  Total: {formatCurrency(filteredPayments.reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center gap-3 p-3 rounded-md border"
                    data-testid={`pending-payment-${payment.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getDebtorName(payment.debtorId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.paymentMethod === "ach" && "ACH Transfer"}
                        {payment.paymentMethod === "card" && "Credit/Debit Card"}
                        {payment.paymentMethod === "check" && "Check"}
                        {" "} • {payment.frequency === "one_time" ? "One-time" : payment.frequency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                    </div>
                    {renderPaymentActions(payment, false, false)}
                    <StatusBadge status={payment.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ) : pendingPayments && pendingPayments.length > 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No pending payments for {format(selectedDate!, "PPP")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {pendingPayments.length} payment{pendingPayments.length !== 1 ? "s" : ""} scheduled on other dates
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground">No pending payments</p>
              <p className="text-sm text-muted-foreground mt-1">
                Record payments in the workstation to see them here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {declinedPayments.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Declined Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {declinedPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                  data-testid={`failed-payment-${payment.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getDebtorName(payment.debtorId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.paymentMethod === "ach" && "ACH Transfer"}
                      {payment.paymentMethod === "card" && "Credit/Debit Card"}
                      {payment.paymentMethod === "check" && "Check"}
                      {payment.notes && ` • ${payment.notes}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">{formatDate(payment.paymentDate)}</p>
                  </div>
                  {renderPaymentActions(payment, true, false)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pastDuePayments.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Past Due Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastDuePayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                  data-testid={`pastdue-payment-${payment.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getDebtorName(payment.debtorId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.paymentMethod === "ach" && "ACH Transfer"}
                      {payment.paymentMethod === "card" && "Credit/Debit Card"}
                      {payment.paymentMethod === "check" && "Check"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Due {formatDate(payment.paymentDate)}</p>
                  </div>
                  {renderPaymentActions(payment, false, false)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {processedPayments && processedPayments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 flex-wrap">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-blue-500" />
              Processed Payments (Awaiting Post)
            </CardTitle>
            <Button
              onClick={() => postAllProcessedMutation.mutate()}
              disabled={postAllProcessedMutation.isPending}
              data-testid="button-post-all"
            >
              {postAllProcessedMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-2" />
              )}
              Post All Processed ({processedPayments.length})
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {processedPayments.slice(0, 10).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 p-3 rounded-md border"
                  data-testid={`processed-payment-${payment.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getDebtorName(payment.debtorId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.paymentMethod === "ach" && "ACH Transfer"}
                      {payment.paymentMethod === "card" && "Credit/Debit Card"}
                      {payment.paymentMethod === "check" && "Check"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                  </div>
                  {renderPaymentActions(payment, false, true)}
                  <StatusBadge status={payment.status} size="sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Payment</DialogTitle>
            <DialogDescription>
              This will reverse the payment and automatically cancel any future scheduled payments for this account.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{getDebtorName(selectedPayment.debtorId)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(selectedPayment.amount)} - {formatDate(selectedPayment.paymentDate)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Reason for Reversal</Label>
                <Textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="Enter reason for reversing this payment..."
                  data-testid="input-reverse-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReverse}
              disabled={reversePaymentMutation.isPending}
              data-testid="button-confirm-reverse"
            >
              {reversePaymentMutation.isPending ? "Reversing..." : "Reverse Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
