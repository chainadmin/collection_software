import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Users,
  CreditCard,
  TrendingUp,
  Phone,
  Calendar,
  ArrowRight,
  FolderKanban,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";
import { Link } from "wouter";
import type { DashboardStats, Debtor, Payment, Portfolio } from "@shared/schema";

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

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentPayments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments/recent"],
  });

  const { data: portfolios, isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: debtors, isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors/recent"],
  });

  const { data: collectorPerformance, isLoading: performanceLoading } = useQuery<CollectorPerformance[]>({
    queryKey: ["/api/collectors/performance"],
  });

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your collection operations
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild data-testid="button-add-debtor">
            <Link href="/debtors?action=add">
              <Users className="h-4 w-4 mr-2" />
              Add Debtor
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-run-payments">
            <Link href="/payment-runner">
              <CreditCard className="h-4 w-4 mr-2" />
              Run Payments
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Collections Today"
              value={formatCurrencyCompact(stats?.collectionsToday || 0)}
              icon={DollarSign}
              subtitle="Posted payments today"
            />
            <StatCard
              title="Active Accounts"
              value={(stats?.activeAccounts || 0).toLocaleString()}
              subtitle={`${stats?.accountsInPayment || 0} in payment plans`}
              icon={Users}
            />
            <StatCard
              title="Recovery Rate"
              value={`${((stats?.recoveryRate || 0)).toFixed(1)}%`}
              icon={TrendingUp}
              subtitle="Overall collection rate"
            />
            <StatCard
              title="Avg Collection"
              value={formatCurrency(stats?.avgCollectionAmount || 0)}
              icon={CreditCard}
              subtitle="Per payment average"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Target className="h-5 w-5" />
              Team Performance
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentMonth} collections with new money and {nextMonth} scheduled payments
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild data-testid="link-view-collectors">
            <Link href="/collectors">
              Manage Team
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {performanceLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : collectorPerformance && collectorPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Collector</th>
                    <th className="pb-2 pr-4 text-right">Start of Month</th>
                    <th className="pb-2 pr-4 text-right">Current</th>
                    <th className="pb-2 pr-4 text-right">New Money</th>
                    <th className="pb-2 pr-4 text-right">Declined</th>
                    <th className="pb-2 pr-4 text-right">Reversed</th>
                    <th className="pb-2 pr-4 text-right">{nextMonth} Pending</th>
                    <th className="pb-2 pr-4 text-right">Goal</th>
                    <th className="pb-2" style={{ minWidth: "150px" }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {collectorPerformance.map((collector) => (
                    <tr
                      key={collector.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`performance-row-${collector.id}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{collector.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {collector.role}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatCurrencyCompact(collector.somTotal)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono">
                          {formatCurrencyCompact(collector.currentTotal)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-green-600 dark:text-green-400 font-medium">
                          {formatCurrencyCompact(collector.newMoney)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-red-600 dark:text-red-400">
                          {formatCurrencyCompact(collector.totalDeclined)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-orange-600 dark:text-orange-400">
                          {formatCurrencyCompact(collector.totalReversed)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-yellow-600 dark:text-yellow-400">
                          {formatCurrencyCompact(collector.nextMonthPending)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono">
                          {formatCurrencyCompact(collector.currentMonthGoal)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.min(collector.goalProgress, 100)} 
                            className="h-2 flex-1"
                          />
                          <span className={`text-xs font-medium min-w-[40px] text-right ${
                            collector.goalProgress >= 100 
                              ? 'text-green-600 dark:text-green-400' 
                              : collector.goalProgress >= 75 
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-muted-foreground'
                          }`}>
                            {collector.goalProgress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No collectors found</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/collectors?action=add">Add your first collector</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-lg font-medium">Portfolio Summary</CardTitle>
            <Button variant="ghost" size="sm" asChild data-testid="link-view-portfolios">
              <Link href="/portfolios">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {portfoliosLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : portfolios && portfolios.length > 0 ? (
              <div className="space-y-3">
                {portfolios.slice(0, 5).map((portfolio) => (
                  <div
                    key={portfolio.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate"
                    data-testid={`portfolio-row-${portfolio.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{portfolio.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {portfolio.totalAccounts.toLocaleString()} accounts
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium">
                        {formatCurrencyCompact(portfolio.totalFaceValue)}
                      </p>
                      <StatusBadge status={portfolio.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No portfolios yet</p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/portfolios?action=add">Add your first portfolio</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-lg font-medium">Recent Payments</CardTitle>
            <Button variant="ghost" size="sm" asChild data-testid="link-view-payments">
              <Link href="/payment-runner">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentPayments && recentPayments.length > 0 ? (
              <div className="space-y-3">
                {recentPayments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    data-testid={`payment-row-${payment.id}`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.paymentMethod.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={payment.status} size="sm" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(payment.paymentDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No recent payments</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg font-medium">Accounts Requiring Attention</CardTitle>
          <Button variant="ghost" size="sm" asChild data-testid="link-view-debtors">
            <Link href="/debtors">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {debtorsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : debtors && debtors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Account</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Balance</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Follow Up</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.slice(0, 5).map((debtor) => (
                    <tr
                      key={debtor.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`debtor-row-${debtor.id}`}
                    >
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono">{debtor.accountNumber}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-medium">
                          {debtor.firstName} {debtor.lastName}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono font-medium">
                          {formatCurrency(debtor.currentBalance)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={debtor.status} size="sm" />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {debtor.nextFollowUpDate ? formatDate(debtor.nextFollowUpDate) : "Not set"}
                        </div>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/debtors/${debtor.id}`}>
                            <Phone className="h-4 w-4 mr-1" />
                            Work
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No accounts to display</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/debtors?action=add">Add your first debtor</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
