import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Download, TrendingUp, Phone, DollarSign, Target, Clock, Wallet, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import type { Collector } from "@shared/schema";

interface CollectorPerformance {
  id: string;
  name: string;
  role: string;
  somTotal: number;
  currentTotal: number;
  currentPending: number;
  currentPosted: number;
  newMoney: number;
  totalDeclined: number;
  totalReversed: number;
  nextMonthPending: number;
  currentMonthGoal: number;
  goalProgress: number;
}

export default function CollectorReporting() {
  const [dateRange, setDateRange] = useState("this_month");
  const [selectedCollector, setSelectedCollector] = useState("");

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: performanceData = [], isLoading: perfLoading } = useQuery<CollectorPerformance[]>({
    queryKey: ["/api/collectors/performance"],
  });

  // Calculate hours based on date range
  const getHoursWorked = () => {
    switch (dateRange) {
      case "today": return 8;
      case "this_week": return 40;
      case "this_month": return 160;
      case "this_quarter": return 480;
      default: return 160;
    }
  };

  const hoursWorked = getHoursWorked();

  // Merge collector data with performance data
  const collectorMetrics = collectors.map((c) => {
    const perf = performanceData.find(p => p.id === c.id);
    const collections = perf?.currentPosted || 0;
    
    // Profitability calculation
    const hourlyWage = c.hourlyWage || 1500; // Default $15/hr in cents
    const wageCost = (hourlyWage / 100) * hoursWorked;
    const collectionsInDollars = collections / 100;
    const profit = collectionsInDollars - wageCost;
    const profitMargin = collectionsInDollars > 0 ? (profit / collectionsInDollars) * 100 : 0;
    const roi = wageCost > 0 ? (collectionsInDollars / wageCost) : 0;

    return {
      ...c,
      collections,
      newMoney: perf?.newMoney || 0,
      currentPending: perf?.currentPending || 0,
      goalProgress: perf?.goalProgress || 0,
      hourlyWage,
      wageCost,
      profit,
      profitMargin,
      roi,
    };
  });

  const totalCollections = collectorMetrics.reduce((sum, c) => sum + c.collections, 0);
  const totalNewMoney = collectorMetrics.reduce((sum, c) => sum + c.newMoney, 0);
  const totalWageCost = collectorMetrics.reduce((sum, c) => sum + c.wageCost, 0);
  const totalProfit = (totalCollections / 100) - totalWageCost;
  const overallROI = totalWageCost > 0 ? ((totalCollections / 100) / totalWageCost) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collector Reporting</h1>
          <p className="text-muted-foreground">Individual and team performance metrics with profitability analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{collectors.length}</p>
                <p className="text-sm text-muted-foreground">Active Collectors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalCollections)}</p>
                <p className="text-sm text-muted-foreground">Total Collections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalNewMoney)}</p>
                <p className="text-sm text-muted-foreground">New Money</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Wallet className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalWageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-sm text-muted-foreground">Wage Cost ({hoursWorked}hrs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${totalProfit >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <TrendingUp className={`h-6 w-6 ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {overallROI.toFixed(1)}x ROI
                </p>
                <p className="text-sm text-muted-foreground">Profit: ${totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Collector Performance & Profitability</CardTitle>
          <CardDescription>Detailed metrics and cost analysis for each collector</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Collector</th>
                  <th className="text-right py-3 px-4 font-medium">Hourly Rate</th>
                  <th className="text-right py-3 px-4 font-medium">Wage Cost</th>
                  <th className="text-right py-3 px-4 font-medium">Collections</th>
                  <th className="text-right py-3 px-4 font-medium">Profit</th>
                  <th className="text-right py-3 px-4 font-medium">ROI</th>
                  <th className="text-right py-3 px-4 font-medium">New Money</th>
                  <th className="text-right py-3 px-4 font-medium">Pending</th>
                  <th className="text-right py-3 px-4 font-medium">Goal Progress</th>
                </tr>
              </thead>
              <tbody>
                {collectorMetrics.map((collector) => {
                  const goalProgress = collector.goal ? (collector.collections / collector.goal) * 100 : 0;
                  return (
                    <tr key={collector.id} className="border-b hover:bg-muted/50" data-testid={`row-collector-${collector.id}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{collector.avatarInitials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{collector.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{collector.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-mono text-sm">
                        ${(collector.hourlyWage / 100).toFixed(2)}/hr
                      </td>
                      <td className="text-right py-3 px-4 font-mono text-sm text-muted-foreground">
                        ${collector.wageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right py-3 px-4 font-mono">{formatCurrency(collector.collections)}</td>
                      <td className={`text-right py-3 px-4 font-mono ${collector.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${collector.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant={collector.roi >= 5 ? "default" : collector.roi >= 2 ? "secondary" : "destructive"}>
                          {collector.roi.toFixed(1)}x
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">{formatCurrency(collector.newMoney)}</td>
                      <td className="text-right py-3 px-4 font-mono text-muted-foreground">{formatCurrency(collector.currentPending)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${goalProgress >= 100 ? "bg-green-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(goalProgress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10">{goalProgress.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profitability Analysis</CardTitle>
          <CardDescription>Cost vs. revenue breakdown by collector</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {collectorMetrics.map((collector) => {
              const collectionsInDollars = collector.collections / 100;
              const maxValue = Math.max(collectionsInDollars, collector.wageCost);
              const collectionsPercent = (collectionsInDollars / maxValue) * 100;
              const wagePercent = (collector.wageCost / maxValue) * 100;
              
              return (
                <div key={collector.id} className="space-y-2" data-testid={`profitability-${collector.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{collector.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{collector.name}</span>
                    </div>
                    <span className={`text-sm font-medium ${collector.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {collector.profit >= 0 ? "+" : ""}${collector.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex gap-2 h-4">
                    <div 
                      className="bg-green-500 rounded"
                      style={{ width: `${collectionsPercent}%` }}
                      title={`Collections: $${collectionsInDollars.toLocaleString()}`}
                    />
                  </div>
                  <div className="flex gap-2 h-4">
                    <div 
                      className="bg-red-400 rounded"
                      style={{ width: `${wagePercent}%` }}
                      title={`Wage Cost: $${collector.wageCost.toLocaleString()}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-500 rounded" /> Collections: ${collectionsInDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-red-400 rounded" /> Wage: ${collector.wageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
