import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, TrendingUp, Users, CheckCircle } from "lucide-react";
import type { Payment, Debtor, Collector } from "@shared/schema";

export default function Whiteboard() {
  const today = new Date().toISOString().split("T")[0];

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments/recent"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const todayPayments = payments.filter(
    (p) => p.paymentDate === today && p.status === "processed"
  );

  const totalCollectedToday = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const transactionCount = todayPayments.length;

  const collectorStats = collectors.map((collector) => {
    const collectorPayments = todayPayments.filter(
      (p) => p.processedBy === collector.id
    );
    const total = collectorPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      id: collector.id,
      name: collector.name,
      initials: collector.avatarInitials || collector.name.split(" ").map(n => n[0]).join(""),
      collected: total,
      transactions: collectorPayments.length,
    };
  }).sort((a, b) => b.collected - a.collected);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getDebtorName = (debtorId: string) => {
    const debtor = debtors.find((d) => d.id === debtorId);
    return debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today's Whiteboard</h1>
        <p className="text-muted-foreground">
          Office-wide collection activity for {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-collected">
              {formatCurrency(totalCollectedToday)}
            </p>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-transaction-count">
              {transactionCount}
            </p>
            <p className="text-xs text-muted-foreground">Payments processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {transactionCount > 0
                ? formatCurrency(totalCollectedToday / transactionCount)
                : "$0.00"}
            </p>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Collectors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {collectorStats.filter((c) => c.collected > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">With collections today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Collector Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {collectorStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No collection activity yet today
                </p>
              ) : (
                collectorStats.map((collector, index) => (
                  <div
                    key={collector.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`leaderboard-collector-${collector.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {collector.initials}
                      </div>
                      <div>
                        <p className="font-medium">{collector.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {collector.transactions} transaction{collector.transactions !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="font-mono font-bold">
                      {formatCurrency(collector.collected)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {todayPayments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No payments processed today
                  </p>
                ) : (
                  todayPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`payment-${payment.id}`}
                    >
                      <div>
                        <p className="font-medium">{getDebtorName(payment.debtorId)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {payment.paymentMethod.toUpperCase()}
                          </Badge>
                          {payment.referenceNumber && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {payment.referenceNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="font-mono font-bold text-green-600 dark:text-green-400">
                        +{formatCurrency(payment.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
