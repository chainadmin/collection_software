import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Play,
  Pause,
  Plus,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Download,
  RefreshCw,
  CalendarIcon,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentBatch, Payment, Debtor } from "@shared/schema";

interface PaymentWithDebtor extends Payment {
  debtor?: Debtor;
}

export default function PaymentRunner() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());

  const { data: batches, isLoading: batchesLoading } = useQuery<PaymentBatch[]>({
    queryKey: ["/api/payment-batches"],
  });

  const { data: batchPayments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payment-batches", selectedBatchId, "payments"],
    enabled: !!selectedBatchId,
  });

  const { data: pendingPayments, isLoading: pendingLoading } = useQuery<PaymentWithDebtor[]>({
    queryKey: ["/api/payments/pending"],
  });

  const { data: debtors } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const createBatchMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/payment-batches", {
        name,
        createdBy: "current-user",
        createdDate: new Date().toISOString(),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-batches"] });
      setShowCreateDialog(false);
      setBatchName("");
      toast({ title: "Batch created", description: "Payment batch has been created." });
    },
  });

  const runBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/payment-batches/${batchId}/run`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-batches"] });
      toast({ title: "Batch started", description: "Payment batch is now processing." });
    },
  });

  const addToBatchMutation = useMutation({
    mutationFn: async ({ batchId, paymentIds }: { batchId: string; paymentIds: string[] }) => {
      return apiRequest("POST", `/api/payment-batches/${batchId}/add-payments`, { paymentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/pending"] });
      setSelectedPaymentIds(new Set());
      toast({ title: "Payments added", description: "Selected payments have been added to the batch." });
    },
  });

  const getDebtorName = (debtorId: string) => {
    const debtor = debtors?.find((d) => d.id === debtorId);
    return debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown";
  };

  const filteredPendingPayments = pendingPayments?.filter((p) => {
    if (!p.paymentDate) return false;
    const paymentDateStr = format(new Date(p.paymentDate), "yyyy-MM-dd");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    return paymentDateStr === selectedDateStr;
  }) || [];

  const allFilteredPayments = pendingPayments || [];

  const togglePaymentSelection = (paymentId: string) => {
    const newSet = new Set(selectedPaymentIds);
    if (newSet.has(paymentId)) {
      newSet.delete(paymentId);
    } else {
      newSet.add(paymentId);
    }
    setSelectedPaymentIds(newSet);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedPaymentIds);
    filteredPendingPayments.forEach((p) => newSet.add(p.id));
    setSelectedPaymentIds(newSet);
  };

  const clearSelection = () => {
    setSelectedPaymentIds(new Set());
  };

  const queuedBatches = batches?.filter((b) => b.status === "queued") || [];
  const processingBatches = batches?.filter((b) => b.status === "processing") || [];
  const completedBatches = batches?.filter((b) => b.status === "completed" || b.status === "failed") || [];
  const draftBatches = batches?.filter((b) => b.status === "draft") || [];

  const totalProcessed = batches?.reduce((sum, b) => sum + (b.successCount || 0), 0) || 0;
  const totalFailed = batches?.reduce((sum, b) => sum + (b.failedCount || 0), 0) || 0;
  const totalAmount = batches?.reduce((sum, b) => sum + (b.totalAmount || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Payment Runner</h1>
          <p className="text-sm text-muted-foreground">
            Manage and process payment batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-batch">
            <Plus className="h-4 w-4 mr-2" />
            Create Batch
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Processed"
          value={totalProcessed.toLocaleString()}
          subtitle="payments"
          icon={CheckCircle}
        />
        <StatCard
          title="Total Failed"
          value={totalFailed.toLocaleString()}
          subtitle="payments"
          icon={XCircle}
        />
        <StatCard
          title="Total Amount"
          value={formatCurrency(totalAmount)}
          icon={FileText}
        />
        <StatCard
          title="Active Batches"
          value={(processingBatches.length + queuedBatches.length).toString()}
          subtitle={`${processingBatches.length} processing`}
          icon={Loader2}
        />
      </div>

      <Card className="mb-6">
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
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedPaymentIds.size > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedPaymentIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
                {draftBatches.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" data-testid="button-add-to-batch">
                        <Plus className="h-4 w-4 mr-1" />
                        Add to Batch
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {draftBatches.map((batch) => (
                        <DropdownMenuItem
                          key={batch.id}
                          onClick={() =>
                            addToBatchMutation.mutate({
                              batchId: batch.id,
                              paymentIds: Array.from(selectedPaymentIds),
                            })
                          }
                        >
                          {batch.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredPendingPayments.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllFiltered}
                  data-testid="button-select-all"
                >
                  Select All ({filteredPendingPayments.length})
                </Button>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(filteredPendingPayments.reduce((sum, p) => sum + p.amount, 0))}
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredPendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer",
                      selectedPaymentIds.has(payment.id) && "bg-primary/10 border-primary"
                    )}
                    onClick={() => togglePaymentSelection(payment.id)}
                    data-testid={`pending-payment-${payment.id}`}
                  >
                    <Checkbox
                      checked={selectedPaymentIds.has(payment.id)}
                      onCheckedChange={() => togglePaymentSelection(payment.id)}
                      data-testid={`checkbox-payment-${payment.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getDebtorName(payment.debtorId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.paymentMethod.toUpperCase()} • {payment.frequency || "one-time"}
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
          ) : allFilteredPayments.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No pending payments for {format(selectedDate, "PPP")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {allFilteredPayments.length} pending payment(s) on other dates
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No pending payments in the system</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {processingBatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {processingBatches.map((batch) => {
                  const progress = batch.totalPayments
                    ? Math.round(((batch.successCount || 0) + (batch.failedCount || 0)) / batch.totalPayments * 100)
                    : 0;
                  return (
                    <div
                      key={batch.id}
                      className="p-4 rounded-md border bg-muted/30"
                      data-testid={`batch-processing-${batch.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium">{batch.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Started {batch.scheduledDate ? formatDateTime(batch.scheduledDate) : "now"}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" data-testid={`pause-batch-${batch.id}`}>
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                      </div>
                      <Progress value={progress} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {(batch.successCount || 0) + (batch.failedCount || 0)} / {batch.totalPayments} payments
                        </span>
                        <span>{progress}% complete</span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600 dark:text-green-400">
                          {batch.successCount || 0} successful
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          {batch.failedCount || 0} failed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {queuedBatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Queued
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {queuedBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`batch-queued-${batch.id}`}
                  >
                    <div>
                      <p className="font-medium">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.totalPayments} payments • {formatCurrency(batch.totalAmount || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="queued" size="sm" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => runBatchMutation.mutate(batch.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {draftBatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Drafts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {draftBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`batch-draft-${batch.id}`}
                  >
                    <div>
                      <p className="font-medium">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(batch.createdDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="draft" size="sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runBatchMutation.mutate(batch.id)}
                        data-testid={`run-batch-${batch.id}`}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Run
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">Completed Batches</CardTitle>
              <Button variant="ghost" size="sm" data-testid="button-export-history">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : completedBatches.length > 0 ? (
                <div className="space-y-3">
                  {completedBatches.slice(0, 10).map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover-elevate cursor-pointer"
                      onClick={() => setSelectedBatchId(batch.id)}
                      data-testid={`batch-completed-${batch.id}`}
                    >
                      <div>
                        <p className="font-medium">{batch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(batch.processedDate || batch.createdDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs">
                          <p className="text-green-600 dark:text-green-400">
                            {batch.successCount} successful
                          </p>
                          <p className="text-red-600 dark:text-red-400">
                            {batch.failedCount} failed
                          </p>
                        </div>
                        <StatusBadge status={batch.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No completed batches</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Batch Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedBatchId ? (
                paymentsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : batchPayments && batchPayments.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {batchPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        data-testid={`batch-payment-${payment.id}`}
                      >
                        <div>
                          <p className="text-sm font-mono">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-muted-foreground">{payment.paymentMethod}</p>
                        </div>
                        <StatusBadge status={payment.status} size="sm" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No payments in this batch</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a batch to view details
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payment Batch</DialogTitle>
            <DialogDescription>
              Create a new batch for processing payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                placeholder="e.g., January ACH Payments"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                data-testid="input-batch-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createBatchMutation.mutate(batchName)}
              disabled={!batchName || createBatchMutation.isPending}
              data-testid="button-submit-batch"
            >
              {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
