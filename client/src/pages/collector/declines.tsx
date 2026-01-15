import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { XCircle, AlertTriangle, CreditCard } from "lucide-react";
import type { Payment, Debtor, Collector } from "@shared/schema";

export default function Declines() {
  const today = new Date().toISOString().split("T")[0];

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments/recent"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const currentCollector = collectors[1];

  const myDeclines = payments.filter(
    (p) =>
      p.status === "failed" &&
      p.paymentDate === today &&
      p.processedBy === currentCollector?.id
  );

  const allTodayDeclines = payments.filter(
    (p) => p.status === "failed" && p.paymentDate === today
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getDebtorInfo = (debtorId: string) => {
    return debtors.find((d) => d.id === debtorId);
  };

  const totalDeclinedAmount = myDeclines.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Declines</h1>
        <p className="text-muted-foreground">
          Failed payment attempts for {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Declines Today</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-my-decline-count">
              {myDeclines.length}
            </p>
            <p className="text-xs text-muted-foreground">Failed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Declined</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-destructive" data-testid="text-declined-amount">
              {formatCurrency(totalDeclinedAmount)}
            </p>
            <p className="text-xs text-muted-foreground">Amount attempted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Office Total</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {allTodayDeclines.length}
            </p>
            <p className="text-xs text-muted-foreground">All declined today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Declined Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {myDeclines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <XCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No declines today</p>
                <p className="text-sm">Great work! All your payments are going through.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myDeclines.map((payment) => {
                  const debtor = getDebtorInfo(payment.debtorId);
                  return (
                    <div
                      key={payment.id}
                      className="p-4 rounded-md border border-destructive/30 bg-destructive/5"
                      data-testid={`decline-${payment.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {debtor
                                ? `${debtor.firstName} ${debtor.lastName}`
                                : "Unknown Debtor"}
                            </p>
                            <Badge variant="destructive" className="text-xs">
                              DECLINED
                            </Badge>
                          </div>
                          {debtor && (
                            <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                              <p>File: {debtor.fileNumber || "N/A"}</p>
                              <p>Account: {debtor.accountNumber}</p>
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-3">
                            <Badge variant="outline">
                              {payment.paymentMethod.toUpperCase()}
                            </Badge>
                            {payment.referenceNumber && (
                              <span className="text-xs font-mono text-muted-foreground">
                                Ref: {payment.referenceNumber}
                              </span>
                            )}
                          </div>
                          {payment.notes && (
                            <p className="mt-2 text-sm text-muted-foreground italic">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-destructive">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.paymentDate}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
