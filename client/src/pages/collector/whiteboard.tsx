import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, TrendingUp, Users, CheckCircle, Clock } from "lucide-react";
import { buildDebtorFeeRateMap, splitAmountByFee } from "@shared/fee-split";
import { isFellThroughPayment, isDeclinedPendingPayment } from "@shared/nsf";
import type { Payment, Debtor, Collector, Portfolio, FeeSchedule } from "@shared/schema";

export default function Whiteboard() {
  const today = new Date().toISOString().split("T")[0];

  // The full org payment set, not the capped/date-sorted "recent" endpoint --
  // that endpoint returns only the latest 10 rows ordered by paymentDate desc,
  // so a handful of future-dated pending arrangements can push today's actual
  // activity off the list entirely.
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: feeSchedules = [] } = useQuery<FeeSchedule[]>({
    queryKey: ["/api/fee-schedules"],
  });

  // Every dollar figure on this board is net of each account's portfolio
  // placement fee -- what the agency itself keeps, not the raw debtor
  // payment. A portfolio with no fee schedule keeps 100% of every payment,
  // same as before this existed.
  const feeRateByDebtorId = buildDebtorFeeRateMap(debtors, portfolios, feeSchedules);
  const companyAmount = (p: Payment) =>
    splitAmountByFee(p.amount, feeRateByDebtorId.get(p.debtorId) ?? 0).companyAmount;

  const currentMonth = today.slice(0, 7);

  // "posted" is real, settled money, so it's scoped to the day it actually
  // ran (paymentDate). "pending" is a promise a collector booked today --
  // its paymentDate can legitimately be next week (a payment arrangement),
  // so today's whiteboard has to key pending off when it was taken
  // (createdAt), not when it's scheduled to run. Otherwise a $100
  // arrangement booked today for next week would vanish from today's
  // activity and only show up on its due date. It's further scoped to
  // arrangements still due this month, so a promise booked today for a
  // future month doesn't inflate this month's pending figure.
  const postedToday = payments.filter((p) => p.paymentDate === today && p.status === "posted");
  const pendingToday = payments.filter((p) =>
    p.status === "pending" &&
    !isDeclinedPendingPayment(p) &&
    String(p.createdAt).slice(0, 10) === today &&
    String(p.paymentDate).slice(0, 7) === currentMonth
  );
  const todayPayments = [...postedToday, ...pendingToday];

  // An account is "new" (or recovered) as of today if its earliest
  // non-void payment record is dated today. Declined/reversed attempts
  // don't establish prior history, so an account whose only prior records
  // were declined/reversed still counts as new today -- it's collected,
  // not repeat, money.
  const earliestRealPaymentDateByDebtor = new Map<string, string>();
  for (const p of payments) {
    if (isFellThroughPayment(p)) continue;
    const recordDate = String(p.createdAt).slice(0, 10);
    const earliest = earliestRealPaymentDateByDebtor.get(p.debtorId);
    if (!earliest || recordDate < earliest) {
      earliestRealPaymentDateByDebtor.set(p.debtorId, recordDate);
    }
  }
  const newAccountIdsToday = new Set(
    Array.from(earliestRealPaymentDateByDebtor.entries())
      .filter(([, date]) => date === today)
      .map(([debtorId]) => debtorId)
  );

  const totalCollectedToday = postedToday
    .filter((p) => newAccountIdsToday.has(p.debtorId))
    .reduce((sum, p) => sum + companyAmount(p), 0);
  const totalPendingToday = pendingToday.reduce((sum, p) => sum + companyAmount(p), 0);
  const transactionCount = postedToday.length;

  const activeCollectorIdsToday = new Set([
    ...postedToday.map((p) => p.processedBy),
    ...pendingToday.map((p) => p.processedBy),
  ]);

  const collectorInitials = (collector: Collector) =>
    collector.avatarInitials || collector.name.split(" ").map((n) => n[0]).join("");

  // A payment posting today doesn't mean it was collected today -- a
  // recurring installment set up weeks ago posts on its own schedule with
  // no new work behind it. The leaderboard only credits a collector when
  // the underlying account is new (or recovered) within the same window,
  // same as Total Collected above.
  const newAccountPostedToday = postedToday.filter((p) => newAccountIdsToday.has(p.debtorId));

  const topCollectorsToday = collectors
    .map((collector) => {
      const posted = newAccountPostedToday.filter((p) => p.processedBy === collector.id);
      return {
        id: collector.id,
        name: collector.name,
        initials: collectorInitials(collector),
        amount: posted.reduce((sum, p) => sum + companyAmount(p), 0),
        transactions: posted.length,
      };
    })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const topClosersToday = collectors
    .map((collector) => {
      const arrangements = pendingToday.filter((p) => p.processedBy === collector.id);
      return {
        id: collector.id,
        name: collector.name,
        initials: collectorInitials(collector),
        count: arrangements.length,
        amount: arrangements.reduce((sum, p) => sum + companyAmount(p), 0),
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // Monday-start week-to-date, for the longer-horizon Top Collector views.
  const now = new Date();
  const diffToMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const postedThisWeek = payments.filter((p) =>
    p.status === "posted" && p.paymentDate >= weekStartStr && p.paymentDate <= today
  );
  const postedThisMonth = payments.filter((p) =>
    p.status === "posted" && String(p.paymentDate).slice(0, 7) === currentMonth
  );

  // Same "new (or recovered) account" gate as today's leaderboard, just
  // widened to the longer window -- an old arrangement's scheduled posting
  // isn't new work this week/month either.
  const isNewAccountAsOf = (debtorId: string, earliestOnOrAfter: string) => {
    const earliest = earliestRealPaymentDateByDebtor.get(debtorId);
    return earliest !== undefined && earliest >= earliestOnOrAfter && earliest <= today;
  };
  const newAccountPostedThisWeek = postedThisWeek.filter((p) => isNewAccountAsOf(p.debtorId, weekStartStr));
  const newAccountPostedThisMonth = postedThisMonth.filter((p) => isNewAccountAsOf(p.debtorId, `${currentMonth}-01`));

  const topCollectorsByAmount = (list: Payment[]) =>
    collectors
      .map((collector) => ({
        id: collector.id,
        name: collector.name,
        initials: collectorInitials(collector),
        amount: list.filter((p) => p.processedBy === collector.id).reduce((sum, p) => sum + companyAmount(p), 0),
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

  const topCollectorsWeek = topCollectorsByAmount(newAccountPostedThisWeek);
  const topCollectorsMonth = topCollectorsByAmount(newAccountPostedThisMonth);

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

  const renderRankedRow = (
    entry: { id: string; name: string; initials: string },
    index: number,
    primary: string,
    secondary: string | undefined,
    testIdPrefix: string
  ) => (
    <div
      key={entry.id}
      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
      data-testid={`${testIdPrefix}-${entry.id}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-muted-foreground w-6">
          {index + 1}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
          {entry.initials}
        </div>
        <div>
          <p className="font-medium">{entry.name}</p>
          {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
        </div>
      </div>
      <p className="font-mono font-bold">{primary}</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today's Whiteboard</h1>
        <p className="text-muted-foreground">
          Office-wide collection activity for {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-collected">
              {formatCurrency(totalCollectedToday)}
            </p>
            <p className="text-xs text-muted-foreground">New accounts, posted today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-pending">
              {formatCurrency(totalPendingToday)}
            </p>
            <p className="text-xs text-muted-foreground">Booked today, due this month</p>
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
            <p className="text-xs text-muted-foreground">Payments posted</p>
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
            <p className="text-xs text-muted-foreground">Per posted transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Collectors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {activeCollectorIdsToday.size}
            </p>
            <p className="text-xs text-muted-foreground">With activity today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Collectors — Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCollectorsToday.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No collection activity yet today
                </p>
              ) : (
                topCollectorsToday.map((collector, index) =>
                  renderRankedRow(
                    collector,
                    index,
                    formatCurrency(collector.amount),
                    `${collector.transactions} transaction${collector.transactions !== 1 ? "s" : ""}`,
                    "leaderboard-collector-today"
                  )
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Closers — Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClosersToday.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No arrangements booked yet today
                </p>
              ) : (
                topClosersToday.map((collector, index) =>
                  renderRankedRow(
                    collector,
                    index,
                    `${collector.count} arrangement${collector.count !== 1 ? "s" : ""}`,
                    `${formatCurrency(collector.amount)} pending`,
                    "leaderboard-closer-today"
                  )
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Collectors — This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCollectorsWeek.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No collection activity yet this week
                </p>
              ) : (
                topCollectorsWeek.map((collector, index) =>
                  renderRankedRow(collector, index, formatCurrency(collector.amount), undefined, "leaderboard-collector-week")
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Collectors — This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCollectorsMonth.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No collection activity yet this month
                </p>
              ) : (
                topCollectorsMonth.map((collector, index) =>
                  renderRankedRow(collector, index, formatCurrency(collector.amount), undefined, "leaderboard-collector-month")
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {todayPayments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No payments today
                  </p>
                ) : (
                  todayPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className={`flex items-center justify-between p-3 rounded-md border ${payment.status === "pending" ? "border-yellow-500/30 bg-yellow-500/5" : ""}`}
                      data-testid={`payment-${payment.id}`}
                    >
                      <div>
                        <p className="font-medium">{getDebtorName(payment.debtorId)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={payment.status === "pending" ? "secondary" : "outline"} className="text-xs">
                            {payment.status === "pending" ? "PENDING" : "POSTED"}
                          </Badge>
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
                      <p className={`font-mono font-bold ${payment.status === "pending" ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
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
