import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calculator,
  Download,
  Calendar,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatCurrencyCompact, calculateLiquidationRate, isCollectiblePaymentStatus } from "@/lib/utils";
import type { Portfolio, Payment, Debtor } from "@shared/schema";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Liquidation() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const [calculatorFaceValue, setCalculatorFaceValue] = useState("");
  const [calculatorPurchasePrice, setCalculatorPurchasePrice] = useState("");
  const [calculatorCollected, setCalculatorCollected] = useState("");

  const { data: portfolios, isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: debtors, isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const isLoading = portfoliosLoading || paymentsLoading || debtorsLoading;

  // Real collections, computed from posted payments joined through their debtor's
  // portfolio — the liquidation snapshot table has no writer, so it can never
  // reflect actual activity.
  const postedPayments = useMemo(
    () => (payments || []).filter((p) => p.status === "posted"),
    [payments]
  );

  // Liquidation rate is meant to reflect all money that hasn't fallen
  // through -- posted (settled), pending (promised), and any other
  // in-flight status -- not just what's already posted.
  const collectiblePayments = useMemo(
    () => (payments || []).filter((p) => isCollectiblePaymentStatus(p.status)),
    [payments]
  );

  const debtorPortfolioMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of debtors || []) map.set(d.id, d.portfolioId);
    return map;
  }, [debtors]);

  const collectedByPortfolio = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of collectiblePayments) {
      const portfolioId = debtorPortfolioMap.get(payment.debtorId);
      if (!portfolioId) continue;
      totals.set(portfolioId, (totals.get(portfolioId) || 0) + payment.amount);
    }
    return totals;
  }, [collectiblePayments, debtorPortfolioMap]);

  const portfolioPerformance = useMemo(() => {
    return (portfolios || []).map((p) => {
      const collected = collectedByPortfolio.get(p.id) || 0;
      const liquidationRate = calculateLiquidationRate(collected, p.totalFaceValue);
      const profit = collected - p.purchasePrice;
      const roi = p.purchasePrice > 0 ? (profit / p.purchasePrice) * 100 : 0;

      return { ...p, collected, liquidationRate, profit, roi };
    });
  }, [portfolios, collectedByPortfolio]);

  const visiblePortfolios = useMemo(() => {
    if (selectedPortfolioId === "all") return portfolioPerformance;
    return portfolioPerformance.filter((p) => p.id === selectedPortfolioId);
  }, [portfolioPerformance, selectedPortfolioId]);

  const totalFaceValue = visiblePortfolios.reduce((sum, p) => sum + p.totalFaceValue, 0);
  const totalPurchased = visiblePortfolios.reduce((sum, p) => sum + p.purchasePrice, 0);
  const totalCollected = visiblePortfolios.reduce((sum, p) => sum + p.collected, 0);
  const totalAccounts = visiblePortfolios.reduce((sum, p) => sum + p.totalAccounts, 0);
  const overallLiquidationRate = calculateLiquidationRate(totalCollected, totalFaceValue);
  const roi = totalPurchased > 0 ? ((totalCollected - totalPurchased) / totalPurchased) * 100 : 0;

  const relevantDebtorIds = useMemo(() => {
    if (selectedPortfolioId === "all") return null;
    return new Set((debtors || []).filter((d) => d.portfolioId === selectedPortfolioId).map((d) => d.id));
  }, [debtors, selectedPortfolioId]);

  // Last 6 months of posted collections, scoped to the selected portfolio.
  const monthlyTrend = useMemo(() => {
    const currentDate = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const collected = postedPayments
        .filter((p) => {
          if (!p.paymentDate?.startsWith(monthKey)) return false;
          if (relevantDebtorIds && !relevantDebtorIds.has(p.debtorId)) return false;
          return true;
        })
        .reduce((sum, p) => sum + p.amount, 0);
      result.push({
        label: `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        collected,
      });
    }
    return result;
  }, [postedPayments, relevantDebtorIds]);

  const highestMonthlyCollection = Math.max(...monthlyTrend.map((m) => m.collected), 1);

  // Real month-over-month change, replacing what used to be a hardcoded trend value.
  const collectionsTrend = useMemo(() => {
    if (monthlyTrend.length < 2) return undefined;
    const current = monthlyTrend[monthlyTrend.length - 1].collected;
    const previous = monthlyTrend[monthlyTrend.length - 2].collected;
    if (previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.round(Math.abs(change) * 10) / 10, isPositive: change >= 0 };
  }, [monthlyTrend]);

  const calculatorResult = (() => {
    const faceValue = parseFloat(calculatorFaceValue) * 100 || 0;
    const purchasePrice = parseFloat(calculatorPurchasePrice) * 100 || 0;
    const collected = parseFloat(calculatorCollected) * 100 || 0;

    const liquidationRate = calculateLiquidationRate(collected, faceValue);
    const profit = collected - purchasePrice;
    const roiPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
    const costPerDollar = faceValue > 0 ? (purchasePrice / faceValue) * 100 : 0;
    const breakEvenRate = costPerDollar;

    return {
      liquidationRate,
      profit,
      roiPercent,
      costPerDollar,
      breakEvenRate,
    };
  })();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Liquidation Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track portfolio performance and liquidation metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
            <SelectTrigger className="w-[200px]" data-testid="select-portfolio-filter">
              <SelectValue placeholder="All Portfolios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portfolios</SelectItem>
              {portfolios?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export-liquidation">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Face Value"
          value={formatCurrencyCompact(totalFaceValue)}
          icon={DollarSign}
        />
        <StatCard
          title="Total Collected"
          value={formatCurrencyCompact(totalCollected)}
          icon={TrendingUp}
          trend={collectionsTrend}
        />
        <StatCard
          title="Liquidation Rate"
          value={`${overallLiquidationRate.toFixed(2)}%`}
          icon={BarChart3}
        />
        <StatCard
          title="Overall ROI"
          value={`${roi.toFixed(1)}%`}
          icon={roi >= 0 ? TrendingUp : TrendingDown}
          trend={{ value: Math.abs(Math.round(roi * 10) / 10), isPositive: roi >= 0 }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Portfolio Performance</CardTitle>
            <CardDescription>Liquidation rates and ROI by portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : visiblePortfolios.length > 0 ? (
              <div className="space-y-4">
                {visiblePortfolios.map((portfolio) => (
                  <div
                    key={portfolio.id}
                    className="p-4 rounded-md border"
                    data-testid={`liquidation-portfolio-${portfolio.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{portfolio.name}</p>
                        <p className="text-xs text-muted-foreground">{portfolio.creditorName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold font-mono">
                          {portfolio.liquidationRate.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Liquidation Rate</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Face Value</p>
                        <p className="font-mono">{formatCurrencyCompact(portfolio.totalFaceValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Purchased For</p>
                        <p className="font-mono">{formatCurrencyCompact(portfolio.purchasePrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Collected</p>
                        <p className="font-mono">{formatCurrencyCompact(portfolio.collected)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">ROI</p>
                        <p className={`font-mono ${portfolio.roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {portfolio.roi >= 0 ? "+" : ""}{portfolio.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(portfolio.liquidationRate, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PieChart className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No portfolio data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Liquidation Calculator
            </CardTitle>
            <CardDescription>Calculate expected returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="faceValue">Total Face Value ($)</Label>
              <Input
                id="faceValue"
                type="number"
                step="0.01"
                placeholder="100,000"
                value={calculatorFaceValue}
                onChange={(e) => setCalculatorFaceValue(e.target.value)}
                data-testid="input-calc-face-value"
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                placeholder="5,000"
                value={calculatorPurchasePrice}
                onChange={(e) => setCalculatorPurchasePrice(e.target.value)}
                data-testid="input-calc-purchase-price"
              />
            </div>
            <div>
              <Label htmlFor="collected">Amount Collected ($)</Label>
              <Input
                id="collected"
                type="number"
                step="0.01"
                placeholder="15,000"
                value={calculatorCollected}
                onChange={(e) => setCalculatorCollected(e.target.value)}
                data-testid="input-calc-collected"
              />
            </div>

            {(calculatorFaceValue || calculatorPurchasePrice || calculatorCollected) && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Liquidation Rate</span>
                  <span className="font-mono font-medium">
                    {calculatorResult.liquidationRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per Dollar</span>
                  <span className="font-mono">
                    {calculatorResult.costPerDollar.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Break-Even Rate</span>
                  <span className="font-mono">
                    {calculatorResult.breakEvenRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit/Loss</span>
                  <span className={`font-mono font-medium ${calculatorResult.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {calculatorResult.profit >= 0 ? "+" : ""}{formatCurrency(calculatorResult.profit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ROI</span>
                  <span className={`font-mono font-medium ${calculatorResult.roiPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {calculatorResult.roiPercent >= 0 ? "+" : ""}{calculatorResult.roiPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Monthly Collection Trend</CardTitle>
            <CardDescription>Posted payments over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : monthlyTrend.some((m) => m.collected > 0) ? (
              <div className="space-y-3">
                {monthlyTrend.map((month) => (
                  <div key={month.label} className="flex items-center gap-4">
                    <div className="w-20 text-xs text-muted-foreground">{month.label}</div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all"
                        style={{
                          width: `${Math.max((month.collected / highestMonthlyCollection) * 100, month.collected > 0 ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-mono">
                      {formatCurrencyCompact(month.collected)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No historical data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Key Metrics Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Average Collection</p>
                    <p className="text-xs text-muted-foreground">Per account</p>
                  </div>
                </div>
                <p className="text-lg font-semibold font-mono">
                  {formatCurrency(totalCollected / Math.max(totalAccounts, 1))}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Days to Break-Even</p>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </div>
                </div>
                <p className="text-lg font-semibold font-mono">
                  {totalCollected > 0 ? Math.round((totalPurchased / (totalCollected / 365)) || 0) : 0}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Collection Velocity</p>
                    <p className="text-xs text-muted-foreground">Monthly average</p>
                  </div>
                </div>
                <p className="text-lg font-semibold font-mono">
                  {formatCurrencyCompact(totalCollected / 12)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
