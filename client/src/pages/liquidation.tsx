import { useState } from "react";
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
  ArrowRight,
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
import { formatCurrency, formatCurrencyCompact, calculateLiquidationRate } from "@/lib/utils";
import type { Portfolio, LiquidationSnapshot } from "@shared/schema";

export default function Liquidation() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const [calculatorFaceValue, setCalculatorFaceValue] = useState("");
  const [calculatorPurchasePrice, setCalculatorPurchasePrice] = useState("");
  const [calculatorCollected, setCalculatorCollected] = useState("");

  const { data: portfolios, isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: snapshots, isLoading: snapshotsLoading } = useQuery<LiquidationSnapshot[]>({
    queryKey: ["/api/liquidation/snapshots"],
  });

  const totalFaceValue = portfolios?.reduce((sum, p) => sum + p.totalFaceValue, 0) || 0;
  const totalPurchased = portfolios?.reduce((sum, p) => sum + p.purchasePrice, 0) || 0;
  const totalCollected = snapshots?.reduce((sum, s) => sum + s.totalCollected, 0) || 0;
  const overallLiquidationRate = calculateLiquidationRate(totalCollected, totalFaceValue);
  const roi = totalPurchased > 0 ? ((totalCollected - totalPurchased) / totalPurchased) * 100 : 0;

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

  const portfolioPerformance = portfolios?.map((p) => {
    const portfolioSnapshots = snapshots?.filter((s) => s.portfolioId === p.id) || [];
    const collected = portfolioSnapshots.reduce((sum, s) => sum + s.totalCollected, 0);
    const liquidationRate = calculateLiquidationRate(collected, p.totalFaceValue);
    const profit = collected - p.purchasePrice;
    const roi = p.purchasePrice > 0 ? (profit / p.purchasePrice) * 100 : 0;

    return {
      ...p,
      collected,
      liquidationRate,
      profit,
      roi,
    };
  }) || [];

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
          trend={{ value: 8.5, isPositive: true }}
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
          trend={{ value: Math.abs(roi), isPositive: roi >= 0 }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Portfolio Performance</CardTitle>
            <CardDescription>Liquidation rates and ROI by portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            {portfoliosLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : portfolioPerformance.length > 0 ? (
              <div className="space-y-4">
                {portfolioPerformance.map((portfolio) => (
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
          </CardHeader>
          <CardContent>
            {snapshotsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : snapshots && snapshots.length > 0 ? (
              <div className="space-y-3">
                {snapshots.slice(0, 6).map((snapshot, index) => (
                  <div key={snapshot.id} className="flex items-center gap-4">
                    <div className="w-20 text-xs text-muted-foreground">
                      {new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "2-digit",
                      })}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all"
                        style={{
                          width: `${Math.min((snapshot.liquidationRate / 100) * 5, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-mono">
                      {formatCurrencyCompact(snapshot.totalCollected)}
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
                  {formatCurrency(totalCollected / Math.max(portfolios?.reduce((sum, p) => sum + p.totalAccounts, 0) || 1, 1))}
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
                  {Math.round((totalPurchased / (totalCollected / 365)) || 0)}
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
