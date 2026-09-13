import { useState } from "react";
import { Link } from "wouter";
import {
  DollarSign,
  Users,
  CreditCard,
  TrendingUp,
  Undo2,
  ArrowRight,
  FolderKanban,
  LayoutDashboard,
  Wallet,
  Phone,
  Calendar,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";

const DEMO_STATS = {
  collectionsToday: 486200,
  activeAccounts: 3482,
  accountsInPayment: 941,
  recoveryRate: 18.4,
  avgCollectionAmount: 21750,
  reversedAccounts: 12,
  reversedPayments: 14,
  declineRate: 3.1,
};

const DEMO_PORTFOLIOS = [
  { id: "p1", name: "Meridian Bankcard Pool 24-A", totalAccounts: 1204, totalFaceValue: 184320000, status: "open" },
  { id: "p2", name: "Summit Medical Recovery Q1", totalAccounts: 842, totalFaceValue: 96150000, status: "open" },
  { id: "p3", name: "Harborline Auto Deficiency", totalAccounts: 517, totalFaceValue: 61870000, status: "in_payment" },
  { id: "p4", name: "Crestpoint Retail Charge-Off", totalAccounts: 919, totalFaceValue: 73440000, status: "closed" },
];

const DEMO_PAYMENTS = [
  { id: "pay1", amount: 15000, paymentDate: "2026-09-12", paymentMethod: "card", status: "posted" },
  { id: "pay2", amount: 42500, paymentDate: "2026-09-12", paymentMethod: "ach", status: "posted" },
  { id: "pay3", amount: 8900, paymentDate: "2026-09-11", paymentMethod: "card", status: "pending" },
  { id: "pay4", amount: 61200, paymentDate: "2026-09-11", paymentMethod: "card", status: "declined" },
  { id: "pay5", amount: 27300, paymentDate: "2026-09-10", paymentMethod: "ach", status: "posted" },
];

const DEMO_DEBTORS = [
  { id: "d1", accountNumber: "FN-100482", firstName: "Alex", lastName: "Rivera", currentBalance: 348500, status: "in_payment", nextFollowUpDate: "2026-09-14", phone: "(555) 201-4471" },
  { id: "d2", accountNumber: "FN-100519", firstName: "Jordan", lastName: "Blake", currentBalance: 122000, status: "open", nextFollowUpDate: "2026-09-13", phone: "(555) 340-8827" },
  { id: "d3", accountNumber: "FN-100604", firstName: "Taylor", lastName: "Morgan", currentBalance: 976400, status: "disputed", nextFollowUpDate: "2026-09-15", phone: "(555) 118-2290" },
  { id: "d4", accountNumber: "FN-100718", firstName: "Sam", lastName: "Patel", currentBalance: 54300, status: "settled", nextFollowUpDate: null, phone: "(555) 902-6634" },
  { id: "d5", accountNumber: "FN-100802", firstName: "Casey", lastName: "Nguyen", currentBalance: 219900, status: "in_payment", nextFollowUpDate: "2026-09-16", phone: "(555) 447-1183" },
  { id: "d6", accountNumber: "FN-100915", firstName: "Morgan", lastName: "Reyes", currentBalance: 688200, status: "open", nextFollowUpDate: "2026-09-13", phone: "(555) 663-2050" },
];

const DEMO_COLLECTORS = [
  { id: "c1", name: "Dana Whitfield", role: "manager", somTotal: 4820000, currentTotal: 6120000, newMoney: 1300000, totalDeclined: 84000, totalReversed: 21000, nextMonthPending: 940000, currentMonthGoal: 7000000 },
  { id: "c2", name: "Elliot Cho", role: "collector", somTotal: 2110000, currentTotal: 3340000, newMoney: 1230000, totalDeclined: 52000, totalReversed: 9000, nextMonthPending: 610000, currentMonthGoal: 4000000 },
  { id: "c3", name: "Priya Anand", role: "collector", somTotal: 1980000, currentTotal: 2450000, newMoney: 470000, totalDeclined: 61000, totalReversed: 15000, nextMonthPending: 380000, currentMonthGoal: 3500000 },
];

function DemoBanner() {
  return (
    <div className="border-b bg-primary/10 px-4 py-2 text-center text-xs font-medium text-primary sm:text-sm">
      You're viewing a live demo with sample data — nothing here is connected to a real account.{" "}
      <Link href="/signup" className="underline underline-offset-2 hover:opacity-80">
        Start your 14-day free trial
      </Link>
    </div>
  );
}

function DemoLogin({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().toLowerCase() === "test" && password === "test") {
      setError("");
      onSuccess();
      toast({ title: "Welcome to the demo", description: "This is sample data for evaluation purposes only." });
    } else {
      setError("Use the demo credentials below: username \"test\", password \"test\".");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/">
          <img src="/logo.png" alt="Debt Manager Pro" className="h-9 w-auto" />
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <CardTitle>Try the live demo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sign in with the sample credentials to explore the system with dummy data.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-username">Username</Label>
                  <Input
                    id="demo-username"
                    placeholder="test"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    data-testid="input-demo-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-password">Password</Label>
                  <Input
                    id="demo-password"
                    type="password"
                    placeholder="test"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-demo-password"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" data-testid="button-demo-signin">
                  View the demo
                </Button>
              </form>
              <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Demo credentials — username <span className="font-mono font-semibold text-foreground">test</span>, password{" "}
                <span className="font-mono font-semibold text-foreground">test</span>
              </div>
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Ready to get started for real? </span>
                <Link href="/signup" className="text-primary hover:underline">
                  Start a free trial
                </Link>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/" className="hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoDashboardTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Collections Today" value={formatCurrencyCompact(DEMO_STATS.collectionsToday)} icon={DollarSign} subtitle="Posted payments today" />
        <StatCard title="Active Accounts" value={DEMO_STATS.activeAccounts.toLocaleString()} subtitle={`${DEMO_STATS.accountsInPayment} in payment plans`} icon={Users} />
        <StatCard title="Recovery Rate" value={`${DEMO_STATS.recoveryRate.toFixed(1)}%`} icon={TrendingUp} subtitle="Overall collection rate" />
        <StatCard title="Avg Collection" value={formatCurrency(DEMO_STATS.avgCollectionAmount)} icon={CreditCard} subtitle="Per payment average" />
        <StatCard title="Reversed / Decline Rate" value={`${DEMO_STATS.reversedAccounts} accts`} icon={Undo2} subtitle={`${DEMO_STATS.declineRate.toFixed(1)}% decline rate • ${DEMO_STATS.reversedPayments} payments`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DEMO_PORTFOLIOS.map((portfolio) => (
                <div key={portfolio.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate" data-testid={`demo-portfolio-row-${portfolio.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{portfolio.name}</p>
                      <p className="text-xs text-muted-foreground">{portfolio.totalAccounts.toLocaleString()} accounts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium">{formatCurrencyCompact(portfolio.totalFaceValue)}</p>
                    <StatusBadge status={portfolio.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DEMO_PAYMENTS.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`demo-payment-row-${payment.id}`}>
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">{payment.paymentMethod.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={payment.status} size="sm" />
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(payment.paymentDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Accounts Requiring Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                  <th className="pb-2 pr-4">Account</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Balance</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Follow Up</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_DEBTORS.slice(0, 5).map((debtor) => (
                  <tr key={debtor.id} className="border-b last:border-0 hover-elevate" data-testid={`demo-debtor-row-${debtor.id}`}>
                    <td className="py-3 pr-4"><span className="text-sm font-mono">{debtor.accountNumber}</span></td>
                    <td className="py-3 pr-4"><span className="text-sm font-medium">{debtor.firstName} {debtor.lastName}</span></td>
                    <td className="py-3 pr-4"><span className="text-sm font-mono font-medium">{formatCurrency(debtor.currentBalance)}</span></td>
                    <td className="py-3 pr-4"><StatusBadge status={debtor.status} size="sm" /></td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {debtor.nextFollowUpDate ? formatDate(debtor.nextFollowUpDate) : "Not set"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoDebtorsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Accounts</CardTitle>
        <p className="text-sm text-muted-foreground">Sample debtor accounts with balances, status, and contact info.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">Balance</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_DEBTORS.map((debtor) => (
                <tr key={debtor.id} className="border-b last:border-0 hover-elevate">
                  <td className="py-3 pr-4"><span className="text-sm font-mono">{debtor.accountNumber}</span></td>
                  <td className="py-3 pr-4"><span className="text-sm font-medium">{debtor.firstName} {debtor.lastName}</span></td>
                  <td className="py-3 pr-4"><span className="text-sm text-muted-foreground">{debtor.phone}</span></td>
                  <td className="py-3 pr-4"><span className="text-sm font-mono font-medium">{formatCurrency(debtor.currentBalance)}</span></td>
                  <td className="py-3"><StatusBadge status={debtor.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoPaymentsTab() {
  const { toast } = useToast();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-lg font-medium">Payment Runner</CardTitle>
          <p className="text-sm text-muted-foreground">Batch process pending debtor payments through your merchant account.</p>
        </div>
        <Button
          size="sm"
          onClick={() => toast({ title: "This is a demo", description: "No real charges are processed here." })}
          data-testid="button-demo-run-payments"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Run Payments
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_PAYMENTS.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0 hover-elevate">
                  <td className="py-3 pr-4"><span className="text-sm font-mono font-medium">{formatCurrency(payment.amount)}</span></td>
                  <td className="py-3 pr-4"><span className="text-sm text-muted-foreground">{payment.paymentMethod.toUpperCase()}</span></td>
                  <td className="py-3 pr-4"><span className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</span></td>
                  <td className="py-3"><StatusBadge status={payment.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoCollectorsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Team Performance</CardTitle>
        <p className="text-sm text-muted-foreground">Collector productivity, new money, and goal progress for the month.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {DEMO_COLLECTORS.map((collector) => {
            const progress = Math.round((collector.currentTotal / collector.currentMonthGoal) * 100);
            return (
              <div key={collector.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{collector.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">{collector.role}</Badge>
                  </div>
                  <span className="text-sm font-mono font-medium">
                    {formatCurrencyCompact(collector.currentTotal)} / {formatCurrencyCompact(collector.currentMonthGoal)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(progress, 100)} className="h-2 flex-1" />
                  <span className="text-xs font-medium min-w-[40px] text-right">{progress}%</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>New money: <span className="font-mono text-green-600 dark:text-green-400">{formatCurrencyCompact(collector.newMoney)}</span></span>
                  <span>Declined: <span className="font-mono text-red-600 dark:text-red-400">{formatCurrencyCompact(collector.totalDeclined)}</span></span>
                  <span>Reversed: <span className="font-mono text-orange-600 dark:text-orange-400">{formatCurrencyCompact(collector.totalReversed)}</span></span>
                  <span>Next month: <span className="font-mono">{formatCurrencyCompact(collector.nextMonthPending)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoApp() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DemoBanner />
      <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-4 sm:px-6 border-b">
        <div className="flex items-center gap-3">
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-8 w-auto" />
          </Link>
          <Badge data-testid="badge-demo-mode">Demo</Badge>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/signup">
            <Button size="sm" data-testid="button-demo-start-trial">
              Start free trial <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Sample overview of a collection agency's operations</p>
        </div>
        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard" data-testid="tab-demo-dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="debtors" data-testid="tab-demo-debtors">
              <Users className="h-4 w-4 mr-2" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-demo-payments">
              <CreditCard className="h-4 w-4 mr-2" /> Payment Runner
            </TabsTrigger>
            <TabsTrigger value="collectors" data-testid="tab-demo-collectors">
              <Phone className="h-4 w-4 mr-2" /> Collectors
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6"><DemoDashboardTab /></TabsContent>
          <TabsContent value="debtors" className="mt-6"><DemoDebtorsTab /></TabsContent>
          <TabsContent value="payments" className="mt-6"><DemoPaymentsTab /></TabsContent>
          <TabsContent value="collectors" className="mt-6"><DemoCollectorsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Demo() {
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return <DemoLogin onSuccess={() => setAuthed(true)} />;
  }

  return <DemoApp />;
}
