import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addYears, subYears } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  CalendarIcon,
  CreditCard,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import type { Payment, Debtor, Merchant } from "@shared/schema";

interface PaymentWithDebtor extends Payment {
  debtor?: Debtor;
}

export default function PaymentRunner() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const { data: pendingPayments, isLoading: pendingLoading, refetch } = useQuery<PaymentWithDebtor[]>({
    queryKey: ["/api/payments/pending"],
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

  const activeMerchants = merchants?.filter((m) => m.isActive) || [];
  const hasNMI = activeMerchants.some((m) => m.processorType === "nmi");
  const hasUSAePay = activeMerchants.some((m) => m.processorType === "usaepay");

  const totalPending = pendingPayments?.length || 0;
  const totalPendingAmount = pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

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

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Pending"
          value={totalPending.toLocaleString()}
          subtitle="payments scheduled"
          icon={Clock}
        />
        <StatCard
          title="Pending Amount"
          value={formatCurrency(totalPendingAmount)}
          icon={CreditCard}
        />
        <StatCard
          title="Due Today"
          value={todayPayments.length.toLocaleString()}
          subtitle={formatCurrency(todayPayments.reduce((sum, p) => sum + p.amount, 0))}
          icon={CheckCircle}
        />
        <StatCard
          title="Past Due"
          value={pastDuePayments.length.toLocaleString()}
          subtitle={pastDuePayments.length > 0 ? "requires attention" : "all current"}
          icon={pastDuePayments.length > 0 ? XCircle : CheckCircle}
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

      {pastDuePayments.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Past Due Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastDuePayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
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
                    <p className="text-xs text-red-600 dark:text-red-400">Due {formatDate(payment.paymentDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
