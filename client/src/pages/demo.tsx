import { useMemo, useState, type ComponentType, type ReactNode } from "react";
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
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Voicemail,
  CalendarClock,
  Calculator,
  SkipForward,
  Hash,
  Fingerprint,
  MapPin,
  Building2,
  FileText,
  Calendar,
  Lock,
  Mail,
  MessageSquare,
  StickyNote,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";

const DEMO_ORG_NAME = "Meridian Recovery Group";

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

interface WorkspaceNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

interface WorkspaceConsumer {
  id: string;
  fileNumber: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  currentBalance: number;
  originalBalance: number;
  status: string;
  phone: string;
  email: string;
  ssnLast4: string;
  dateOfBirth: string;
  address: string;
  clientName: string;
  originalCreditor: string;
  chargeOffDate: string;
  portfolio: string;
  followUpDate: string;
  lastPaymentOutcome: "approved" | "declined";
  lastPaymentAmount: number;
  lastPaymentDate: string;
  notes: WorkspaceNote[];
}

const DEMO_WORKSPACE_CONSUMERS: WorkspaceConsumer[] = [
  {
    id: "w1",
    fileNumber: "FN-100519",
    accountNumber: "ACC-88213",
    firstName: "Jordan",
    lastName: "Blake",
    currentBalance: 122000,
    originalBalance: 168000,
    status: "open",
    phone: "(555) 340-8827",
    email: "jordan.blake@example.com",
    ssnLast4: "4471",
    dateOfBirth: "1989-03-22",
    address: "482 Wren Street, Columbus OH 43215",
    clientName: "Northgate Bank",
    originalCreditor: "Northgate Bank Visa",
    chargeOffDate: "2025-11-02",
    portfolio: "Meridian Bankcard Pool 24-A",
    followUpDate: "2026-09-13",
    lastPaymentOutcome: "declined",
    lastPaymentAmount: 42500,
    lastPaymentDate: "2026-09-12",
    notes: [
      { id: "n1", author: "Elliot Cho", date: "2026-09-11", content: "Spoke with consumer, requested a call back after payday on the 15th." },
      { id: "n2", author: "System", date: "2026-09-12", content: "Auto payment declined — insufficient funds. Decline notice sent by email." },
    ],
  },
  {
    id: "w2",
    fileNumber: "FN-100482",
    accountNumber: "ACC-77490",
    firstName: "Alex",
    lastName: "Rivera",
    currentBalance: 348500,
    originalBalance: 512000,
    status: "in_payment",
    phone: "(555) 201-4471",
    email: "alex.rivera@example.com",
    ssnLast4: "2290",
    dateOfBirth: "1994-07-09",
    address: "119 Cedar Ave, Tampa FL 33602",
    clientName: "Summit Medical Group",
    originalCreditor: "Summit Medical Group",
    chargeOffDate: "2025-08-14",
    portfolio: "Summit Medical Recovery Q1",
    followUpDate: "2026-09-14",
    lastPaymentOutcome: "approved",
    lastPaymentAmount: 15000,
    lastPaymentDate: "2026-09-12",
    notes: [
      { id: "n3", author: "Dana Whitfield", date: "2026-09-05", content: "Set up a 12-month payment plan at $150/month. Consumer confirmed card on file." },
      { id: "n4", author: "System", date: "2026-09-12", content: "Scheduled payment posted successfully. Receipt sent by email and text." },
    ],
  },
  {
    id: "w3",
    fileNumber: "FN-100604",
    accountNumber: "ACC-63357",
    firstName: "Taylor",
    lastName: "Morgan",
    currentBalance: 976400,
    originalBalance: 976400,
    status: "disputed",
    phone: "(555) 118-2290",
    email: "taylor.morgan@example.com",
    ssnLast4: "6634",
    dateOfBirth: "1981-12-01",
    address: "27 Harbor Ln, Charleston SC 29401",
    clientName: "Harborline Auto Finance",
    originalCreditor: "Harborline Auto Finance",
    chargeOffDate: "2025-05-30",
    portfolio: "Harborline Auto Deficiency",
    followUpDate: "2026-09-15",
    lastPaymentOutcome: "declined",
    lastPaymentAmount: 61200,
    lastPaymentDate: "2026-09-11",
    notes: [
      { id: "n5", author: "Priya Anand", date: "2026-09-09", content: "Consumer disputes the balance and requested debt validation by mail." },
    ],
  },
];

interface WorkspaceTemplate {
  id: string;
  name: string;
  type: "email" | "sms";
  subject?: string;
  body: string;
}

const DEMO_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "t1",
    name: "Payment Reminder",
    type: "email",
    subject: "Payment reminder — Account {{account_number}}",
    body: "Hello {{first_name}}, this is a reminder that your payment of {{balance}} is scheduled soon. Reply or call us with any questions.",
  },
  {
    id: "t2",
    name: "Settlement Offer",
    type: "sms",
    body: "Hi {{first_name}}, {{company_name}} can settle your account for a reduced amount if paid this month. Call us to discuss.",
  },
  {
    id: "t3",
    name: "Payment Plan Confirmation",
    type: "email",
    subject: "Your payment plan is confirmed",
    body: "Hello {{first_name}}, your payment plan for {{balance}} is confirmed. Your next payment is scheduled automatically.",
  },
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

function buildDemoMessage(
  mode: "decline" | "receipt",
  consumer: WorkspaceConsumer,
  automation: { callbackPhone: string; callbackEmail: string },
): string {
  const phone = automation.callbackPhone.trim();
  const email = automation.callbackEmail.trim();
  const contactLine = phone && email
    ? `call ${phone} or email ${email}`
    : phone
      ? `call ${phone}`
      : email
        ? `email ${email}`
        : "contact our office";
  const amount = formatCurrency(consumer.lastPaymentAmount);
  const date = formatDate(new Date().toISOString().slice(0, 10));

  if (mode === "decline") {
    return `Hello ${consumer.firstName}, your payment to ${DEMO_ORG_NAME} for ${amount} dated ${date} came back as declined. Reason: the payment was not approved. Please ${contactLine} to rectify this. Thank you.`;
  }
  return `Hello ${consumer.firstName}, your payment to ${DEMO_ORG_NAME} for ${amount} dated ${date} was approved. Transaction ID: DEMO-${consumer.id.toUpperCase()}-01. If you have questions, please ${contactLine}. Thank you.`;
}

const STATUS_DOT_CLASS: Record<string, string> = {
  newbiz: "bg-indigo-500",
  open: "bg-blue-500",
  in_payment: "bg-yellow-500",
  settled: "bg-green-500",
  closed: "bg-gray-500",
  disputed: "bg-red-500",
};

const WORKSPACE_STATUS_OPTIONS = [
  { code: "newbiz", label: "New Business" },
  { code: "open", label: "Open" },
  { code: "in_payment", label: "In Payment" },
  { code: "disputed", label: "Disputed" },
  { code: "settled", label: "Settled" },
  { code: "closed", label: "Closed" },
];

function InfoTile({
  icon: Icon,
  label,
  value,
  mono,
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-md border bg-background/60 px-3 py-2 min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-0.5">
        <span className={`text-sm break-words ${mono ? "font-mono" : ""}`}>{value}</span>
      </div>
    </div>
  );
}

function DemoWorkspaceTab() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(DEMO_WORKSPACE_CONSUMERS[0].id);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [extraNotes, setExtraNotes] = useState<Record<string, WorkspaceNote[]>>({});

  const consumerIndex = DEMO_WORKSPACE_CONSUMERS.findIndex((c) => c.id === selectedId);
  const consumer = DEMO_WORKSPACE_CONSUMERS[consumerIndex] ?? DEMO_WORKSPACE_CONSUMERS[0];
  const status = statusOverrides[consumer.id] ?? consumer.status;
  const allNotes = [...consumer.notes, ...(extraNotes[consumer.id] ?? [])];

  const notReal = (description: string) => toast({ title: "This is a demo", description });

  const handleAddNote = () => {
    const draft = (noteDrafts[consumer.id] || "").trim();
    if (!draft) return;
    setExtraNotes((current) => ({
      ...current,
      [consumer.id]: [...(current[consumer.id] ?? []), { id: `note-${Date.now()}`, author: "You (Demo)", date: "Just now", content: draft }],
    }));
    setNoteDrafts((current) => ({ ...current, [consumer.id]: "" }));
    toast({ title: "Note saved", description: "Notes auto-save as collectors work an account." });
  };

  const advanceToNext = () => {
    const next = DEMO_WORKSPACE_CONSUMERS[(consumerIndex + 1) % DEMO_WORKSPACE_CONSUMERS.length];
    setSelectedId(next.id);
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[560px] rounded-lg border overflow-hidden">
      <div className="w-72 border-r flex flex-col bg-muted/30 shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Work Queue</h2>
          <p className="text-xs text-muted-foreground mt-1">3 sample consumers for this demo</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {DEMO_WORKSPACE_CONSUMERS.map((c) => {
            const cStatus = statusOverrides[c.id] ?? c.status;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  c.id === consumer.id ? "bg-primary/10 border border-primary/20" : "hover-elevate"
                }`}
                data-testid={`workspace-consumer-${c.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[cStatus] || "bg-gray-500"}`} />
                    <span className="font-medium text-sm">{c.firstName} {c.lastName}</span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{cStatus.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs pl-4">
                  <span className="font-mono">{formatCurrency(c.currentBalance)}</span>
                  <span className="text-muted-foreground">{formatDate(c.followUpDate)}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-4 font-mono">{c.fileNumber}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-xl font-semibold">{consumer.firstName} {consumer.lastName}</h1>
                <Select
                  value={status}
                  onValueChange={(v) => setStatusOverrides((cur) => ({ ...cur, [consumer.id]: v }))}
                >
                  <SelectTrigger className="w-[160px] h-8" data-testid="select-demo-status">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[status] || "bg-gray-500"}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSPACE_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <InfoTile icon={Hash} label="File #" value={consumer.fileNumber} mono />
                <InfoTile icon={Hash} label="Acct #" value={consumer.accountNumber} mono />
                <InfoTile icon={Fingerprint} label="SSN" value={`***-**-${consumer.ssnLast4}`} mono />
                <InfoTile icon={Calendar} label="DOB" value={formatDate(consumer.dateOfBirth)} />
                <InfoTile icon={MapPin} label="Address" className="col-span-2" value={consumer.address} />
                <InfoTile icon={Building2} label="Client" value={consumer.clientName} />
                <InfoTile icon={FileText} label="Creditor" className="col-span-2 sm:col-span-1" value={consumer.originalCreditor} />
                <InfoTile icon={CalendarClock} label="Charge Off" value={formatDate(consumer.chargeOffDate)} />
              </div>
            </div>
            <div className="shrink-0 rounded-lg border-2 border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent px-3 py-2 min-w-[170px]">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold font-mono tabular-nums leading-tight text-primary" data-testid="text-demo-balance">
                {formatCurrency(consumer.currentBalance)}
              </p>
              <div className="mt-1.5 pt-1.5 border-t border-primary/15 space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Original</span>
                  <span className="font-mono tabular-nums">{formatCurrency(consumer.originalBalance)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Last Payment</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(consumer.lastPaymentAmount)} · {formatDate(consumer.lastPaymentDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-b bg-muted/50 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-2">Call Outcome:</span>
          <Button size="sm" variant="outline" onClick={() => notReal("Call outcomes aren't logged in the demo.")} data-testid="button-demo-connected">
            <PhoneIncoming className="h-4 w-4 mr-1" /> Connected
          </Button>
          <Button size="sm" variant="outline" onClick={() => notReal("Call outcomes aren't logged in the demo.")} data-testid="button-demo-no-answer">
            <PhoneOff className="h-4 w-4 mr-1" /> No Answer
          </Button>
          <Button size="sm" variant="outline" onClick={() => notReal("Call outcomes aren't logged in the demo.")} data-testid="button-demo-voicemail">
            <Voicemail className="h-4 w-4 mr-1" /> Voicemail
          </Button>
          <Button size="sm" variant="outline" onClick={() => notReal("Call outcomes aren't logged in the demo.")} data-testid="button-demo-promise">
            <CalendarClock className="h-4 w-4 mr-1" /> Promise
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button size="sm" variant="outline" onClick={() => notReal("The payment calculator isn't wired up in the demo.")} data-testid="button-demo-calculator">
            <Calculator className="h-4 w-4 mr-1" /> Calculator
          </Button>
          <Button size="sm" onClick={() => notReal("No real payment is processed here.")} data-testid="button-demo-record-payment">
            <DollarSign className="h-4 w-4 mr-1" /> Record Payment
          </Button>
          <Button size="sm" variant="ghost" onClick={advanceToNext} data-testid="button-demo-next-account">
            <SkipForward className="h-4 w-4 mr-1" /> Next
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4 max-w-3xl">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => notReal("No real call is placed.")}
                    data-testid="button-demo-call"
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-sm">{consumer.phone}</p>
                        <p className="text-xs text-muted-foreground">Mobile (Primary)</p>
                      </div>
                    </div>
                    <PhoneCall className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-sm">{consumer.email}</p>
                        <p className="text-xs text-muted-foreground">Email (Primary)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="w-80 border-l flex flex-col bg-muted/30 shrink-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <StickyNote className="h-4 w-4" /> Notes &amp; Activity
          </h3>
        </div>
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a quick note..."
              value={noteDrafts[consumer.id] ?? ""}
              onChange={(e) => setNoteDrafts((cur) => ({ ...cur, [consumer.id]: e.target.value }))}
              className="min-h-[60px] resize-none"
              data-testid="textarea-demo-note"
            />
            <Button size="icon" onClick={handleAddNote} disabled={!(noteDrafts[consumer.id] ?? "").trim()} data-testid="button-demo-add-note">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {allNotes.map((n) => (
            <div key={n.id} className="rounded-md bg-muted/50 p-2 text-sm" data-testid={`demo-note-${n.id}`}>
              <p>{n.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{n.author} • {n.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoAutomationTab() {
  const { toast } = useToast();
  const [previewConsumerId, setPreviewConsumerId] = useState(DEMO_WORKSPACE_CONSUMERS[0].id);
  const [previewMode, setPreviewMode] = useState<"decline" | "receipt">("decline");
  const [automation, setAutomation] = useState({
    enabled: true,
    sendDeclineEmail: true,
    sendDeclineSms: false,
    sendReceiptEmail: true,
    sendReceiptSms: true,
    callbackPhone: "(800) 555-0199",
    callbackEmail: "support@meridianrecovery.com",
  });

  const previewConsumer = DEMO_WORKSPACE_CONSUMERS.find((c) => c.id === previewConsumerId) ?? DEMO_WORKSPACE_CONSUMERS[0];

  const updateAutomation = (patch: Partial<typeof automation>) => {
    setAutomation((a) => ({ ...a, ...patch }));
    toast({ title: "Demo settings updated", description: "Not saved to a real account." });
  };

  const messagePreview = useMemo(
    () => buildDemoMessage(previewMode, previewConsumer, automation),
    [previewMode, previewConsumer, automation],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Mail className="h-5 w-5" /> Payment Message Automation
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Automatically email or text a consumer a receipt when their payment posts, or a notice when it declines.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Enable automation</Label>
              <p className="text-xs text-muted-foreground">Uses your logo and callback details below.</p>
            </div>
            <Switch
              checked={automation.enabled}
              onCheckedChange={(checked) => updateAutomation({ enabled: checked })}
              data-testid="switch-demo-automation-enabled"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="demo-callback-phone">Callback Phone</Label>
              <Input
                id="demo-callback-phone"
                value={automation.callbackPhone}
                onChange={(e) => setAutomation((a) => ({ ...a, callbackPhone: e.target.value }))}
                data-testid="input-demo-callback-phone"
              />
            </div>
            <div>
              <Label htmlFor="demo-callback-email">Callback Email</Label>
              <Input
                id="demo-callback-email"
                value={automation.callbackEmail}
                onChange={(e) => setAutomation((a) => ({ ...a, callbackEmail: e.target.value }))}
                data-testid="input-demo-callback-email"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <ImageIcon className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Your company logo appears on every email</p>
              <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP — shown at the top of receipts and decline notices.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" /> When a payment declines
              </p>
              <div className="flex items-center justify-between">
                <Label>Email</Label>
                <Switch checked={automation.sendDeclineEmail} onCheckedChange={(c) => updateAutomation({ sendDeclineEmail: c })} data-testid="switch-demo-decline-email" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Text message</Label>
                <Switch checked={automation.sendDeclineSms} onCheckedChange={(c) => updateAutomation({ sendDeclineSms: c })} data-testid="switch-demo-decline-sms" />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> When a payment is approved
              </p>
              <div className="flex items-center justify-between">
                <Label>Email receipt</Label>
                <Switch checked={automation.sendReceiptEmail} onCheckedChange={(c) => updateAutomation({ sendReceiptEmail: c })} data-testid="switch-demo-receipt-email" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Text receipt</Label>
                <Switch checked={automation.sendReceiptSms} onCheckedChange={(c) => updateAutomation({ sendReceiptSms: c })} data-testid="switch-demo-receipt-sms" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-sm font-medium">Live preview for</p>
              <Select value={previewConsumerId} onValueChange={setPreviewConsumerId}>
                <SelectTrigger className="w-[160px] h-8" data-testid="select-demo-preview-consumer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_WORKSPACE_CONSUMERS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant={previewMode === "decline" ? "default" : "outline"} onClick={() => setPreviewMode("decline")} data-testid="button-demo-preview-decline">
                  Decline notice
                </Button>
                <Button size="sm" variant={previewMode === "receipt" ? "default" : "outline"} onClick={() => setPreviewMode("receipt")} data-testid="button-demo-preview-receipt">
                  Receipt
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed" data-testid="text-demo-message-preview">
              {messagePreview}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Send className="h-5 w-5" /> Message Templates
          </CardTitle>
          <p className="text-sm text-muted-foreground">Reusable email and text templates collectors can send to any account.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_TEMPLATES.map((template) => (
            <div key={template.id} className="rounded-md border p-3" data-testid={`demo-template-${template.id}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {template.type === "email" ? (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{template.name}</span>
                  <Badge variant="outline" className="text-xs uppercase">{template.type}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toast({ title: "This is a demo", description: "No real message is sent." })}
                  data-testid={`button-demo-send-${template.id}`}
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
              </div>
              {template.subject && <p className="text-xs text-muted-foreground mt-2">Subject: {template.subject}</p>}
              <p className="text-sm mt-1 text-muted-foreground">{template.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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
          <h1 className="text-2xl font-semibold">Live Demo</h1>
          <p className="text-sm text-muted-foreground">Explore a sample collection agency's operations, account workspace, and automation</p>
        </div>
        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard" data-testid="tab-demo-dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="debtors" data-testid="tab-demo-debtors">
              <Users className="h-4 w-4 mr-2" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="workspace" data-testid="tab-demo-workspace">
              <PhoneCall className="h-4 w-4 mr-2" /> Workspace
            </TabsTrigger>
            <TabsTrigger value="automation" data-testid="tab-demo-automation">
              <Mail className="h-4 w-4 mr-2" /> Automation
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
          <TabsContent value="workspace" className="mt-6"><DemoWorkspaceTab /></TabsContent>
          <TabsContent value="automation" className="mt-6"><DemoAutomationTab /></TabsContent>
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
