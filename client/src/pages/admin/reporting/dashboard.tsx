import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, TrendingUp, TrendingDown, DollarSign, Users, Target, Calendar, ArrowUpRight, ArrowDownRight, XCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import type { Payment, Debtor } from "@shared/schema";

interface DashboardStats {
  collectionsToday: number;
  collectionsThisMonth: number;
  activeAccounts: number;
  accountsInPayment: number;
  recoveryRate: number;
  avgCollectionAmount: number;
  totalPortfolioValue: number;
  totalCollected: number;
}

export default function CompanyDashboard() {
  const [dateRange, setDateRange] = useState("this_month");
  const today = new Date().toISOString().split("T")[0];

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?dateRange=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const todaysDeclines = payments.filter(
    (p) => (p.status === "failed" || p.status === "declined") && p.paymentDate === today
  );

  const totalDeclinedAmount = todaysDeclines.reduce((sum, p) => sum + p.amount, 0);

  const getDebtorName = (debtorId: string) => {
    const debtor = debtors.find((d) => d.id === debtorId);
    return debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown";
  };

  const monthlyData = [
    { month: "Jul", collections: 1850000, target: 2000000 },
    { month: "Aug", collections: 2150000, target: 2000000 },
    { month: "Sep", collections: 1980000, target: 2000000 },
    { month: "Oct", collections: 2320000, target: 2200000 },
    { month: "Nov", collections: 2450000, target: 2200000 },
    { month: "Dec", collections: 2320500, target: 2500000 },
  ];

  const topCollectors = [
    { name: "Michael Chen", collections: 875000, accounts: 45, rate: 0.35 },
    { name: "Emily Rodriguez", collections: 650000, accounts: 38, rate: 0.28 },
    { name: "Sarah Johnson", collections: 450000, accounts: 22, rate: 0.32 },
  ];

  const portfolioPerformance = [
    { name: "Chase Q4 2024", collected: 1250000, target: 3000000, rate: 0.42 },
    { name: "Capital One Medical", collected: 875000, target: 2500000, rate: 0.35 },
    { name: "Auto Loan Portfolio A", collected: 225000, target: 5000000, rate: 0.05 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Company Dashboard</h1>
          <p className="text-muted-foreground">Performance overview and analytics</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalCollected || 2320500)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              <span className="text-green-500">12.5%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Accounts</p>
                <p className="text-2xl font-bold">{stats?.activeAccounts || 4240}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <span className="text-red-500">3.2%</span>
              <span className="text-muted-foreground">accounts resolved</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recovery Rate</p>
                <p className="text-2xl font-bold">{((stats?.recoveryRate || 0.30) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Target className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              <span className="text-green-500">2.1%</span>
              <span className="text-muted-foreground">improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalPortfolioValue || 775000000)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <LayoutDashboard className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Across all portfolios</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Collections</CardTitle>
            <CardDescription>Collection performance vs targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((month) => {
                const percentage = (month.collections / month.target) * 100;
                const isAboveTarget = percentage >= 100;
                return (
                  <div key={month.month} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{month.month}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{formatCurrency(month.collections)}</span>
                        <Badge variant={isAboveTarget ? "default" : "secondary"}>
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isAboveTarget ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Collectors</CardTitle>
            <CardDescription>Best performing collectors this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCollectors.map((collector, index) => (
                <div key={collector.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{collector.name}</p>
                      <p className="text-sm text-muted-foreground">{collector.accounts} accounts worked</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium">{formatCurrency(collector.collections)}</p>
                    <p className="text-sm text-muted-foreground">{(collector.rate * 100).toFixed(0)}% rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Portfolio Performance</CardTitle>
            <CardDescription>Collection rates by portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {portfolioPerformance.map((portfolio) => (
                <div key={portfolio.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{portfolio.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-mono">{formatCurrency(portfolio.collected)}</span>
                      <span className="text-muted-foreground">/ {formatCurrency(portfolio.target)}</span>
                      <Badge variant={portfolio.rate >= 0.3 ? "default" : "secondary"}>
                        {(portfolio.rate * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${portfolio.rate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Today's Declines Whiteboard
            </CardTitle>
            <CardDescription>Office-wide declined payments for {new Date().toLocaleDateString()}</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Declined</p>
              <p className="text-xl font-bold font-mono text-destructive" data-testid="text-total-declined">
                {formatCurrency(totalDeclinedAmount)}
              </p>
            </div>
            <Badge variant="destructive" className="text-lg px-3 py-1" data-testid="badge-decline-count">
              {todaysDeclines.length} declines
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todaysDeclines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No declined payments today
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {todaysDeclines.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`decline-row-${payment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium">{getDebtorName(payment.debtorId)}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.paymentMethod.toUpperCase()} - {payment.notes || "No reason provided"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-destructive">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ref: {payment.referenceNumber || "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
