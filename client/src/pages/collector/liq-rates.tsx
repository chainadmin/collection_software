import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, DollarSign, Percent } from "lucide-react";
import type { Payment, Debtor, Collector, Portfolio } from "@shared/schema";

export default function LiqRates() {
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments/recent"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const currentCollector = collectors[1];

  const myDebtors = debtors.filter(
    (d) => d.assignedCollectorId === currentCollector?.id
  );

  const myPayments = payments.filter(
    (p) => p.status === "processed" && p.processedBy === currentCollector?.id
  );

  const totalOriginalBalance = myDebtors.reduce(
    (sum, d) => sum + d.originalBalance,
    0
  );
  const totalCurrentBalance = myDebtors.reduce(
    (sum, d) => sum + d.currentBalance,
    0
  );
  const totalCollected = myPayments.reduce((sum, p) => sum + p.amount, 0);

  const liquidationRate =
    totalOriginalBalance > 0
      ? ((totalCollected / totalOriginalBalance) * 100).toFixed(2)
      : "0.00";

  const recoveryRate =
    totalOriginalBalance > 0
      ? (((totalOriginalBalance - totalCurrentBalance) / totalOriginalBalance) * 100).toFixed(2)
      : "0.00";

  const goalProgress =
    currentCollector?.goal && currentCollector.goal > 0
      ? (totalCollected / currentCollector.goal) * 100
      : 0;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const portfolioStats = portfolios.map((portfolio) => {
    const portfolioDebtors = myDebtors.filter(
      (d) => d.portfolioId === portfolio.id
    );
    const portfolioOriginal = portfolioDebtors.reduce(
      (sum, d) => sum + d.originalBalance,
      0
    );
    const portfolioCurrent = portfolioDebtors.reduce(
      (sum, d) => sum + d.currentBalance,
      0
    );
    const collected = portfolioOriginal - portfolioCurrent;
    const rate = portfolioOriginal > 0 ? (collected / portfolioOriginal) * 100 : 0;

    return {
      id: portfolio.id,
      name: portfolio.name,
      accountCount: portfolioDebtors.length,
      originalBalance: portfolioOriginal,
      collected,
      rate,
    };
  }).filter((p) => p.accountCount > 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Liquidation Rates</h1>
        <p className="text-muted-foreground">
          Your personal collection performance metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liquidation Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-liq-rate">
              {liquidationRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              Collected vs Original Balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono" data-testid="text-total-collected">
              {formatCurrency(totalCollected)}
            </p>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-recovery-rate">
              {recoveryRate}%
            </p>
            <p className="text-xs text-muted-foreground">Balance reduction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Accounts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-account-count">
              {myDebtors.length}
            </p>
            <p className="text-xs text-muted-foreground">Assigned to me</p>
          </CardContent>
        </Card>
      </div>

      {currentCollector?.goal && currentCollector.goal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Goal Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(totalCollected)} of {formatCurrency(currentCollector.goal)}
                </span>
                <span className="text-sm font-medium">
                  {Math.min(goalProgress, 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(goalProgress, 100)} className="h-3" />
              {goalProgress >= 100 && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Congratulations! You've exceeded your monthly goal!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Performance by Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No accounts assigned yet
            </p>
          ) : (
            <div className="space-y-4">
              {portfolioStats.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="p-4 rounded-md border"
                  data-testid={`portfolio-stat-${portfolio.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">{portfolio.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {portfolio.accountCount} account{portfolio.accountCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{portfolio.rate.toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Liq Rate</p>
                    </div>
                  </div>
                  <Progress value={portfolio.rate} className="h-2" />
                  <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                    <span>Collected: {formatCurrency(portfolio.collected)}</span>
                    <span>Original: {formatCurrency(portfolio.originalBalance)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
