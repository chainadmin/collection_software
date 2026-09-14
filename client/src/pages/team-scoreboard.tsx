import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X, Trophy } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface CollectorMonthlyBreakdown {
  month: string;
  label: string;
  posted: number;
  pending: number;
}

interface CollectorPerformance {
  id: string;
  name: string;
  role: string;
  somTotal: number;
  currentTotal: number;
  newMoney: number;
  currentMonthGoal: number;
  monthlyBreakdown: CollectorMonthlyBreakdown[];
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TeamScoreboard() {
  const { organization } = useOrganization();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: performanceData = [], dataUpdatedAt } = useQuery<CollectorPerformance[]>({
    queryKey: ["/api/collectors/performance"],
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const monthKey = currentMonthKey();

  const rows = performanceData
    .map((c) => {
      const thisMonth = c.monthlyBreakdown.find((m) => m.month === monthKey);
      const posted = thisMonth?.posted || 0;
      const pending = thisMonth?.pending || 0;
      const needed = Math.max(c.currentMonthGoal - c.newMoney, 0);
      const progress = c.currentMonthGoal > 0 ? Math.min((c.newMoney / c.currentMonthGoal) * 100, 100) : 0;
      return {
        id: c.id,
        name: c.name,
        start: c.somTotal,
        newMoney: c.newMoney,
        posted,
        pending,
        total: c.currentTotal,
        goal: c.currentMonthGoal,
        needed,
        progress,
      };
    })
    .sort((a, b) => b.newMoney - a.newMoney);

  const company = rows.reduce(
    (sum, r) => ({
      start: sum.start + r.start,
      newMoney: sum.newMoney + r.newMoney,
      posted: sum.posted + r.posted,
      pending: sum.pending + r.pending,
      total: sum.total + r.total,
      goal: sum.goal + r.goal,
    }),
    { start: 0, newMoney: 0, posted: 0, pending: 0, total: 0, goal: 0 },
  );
  const companyNeeded = Math.max(company.goal - company.newMoney, 0);
  const companyProgress = company.goal > 0 ? Math.min((company.newMoney / company.goal) * 100, 100) : 0;

  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            {organization?.name || "Team"} — {monthLabel}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold mt-1">Monthly Scoreboard</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl sm:text-3xl font-mono font-semibold tabular-nums">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          </p>
          <Link href="/app" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-2" data-testid="link-exit-scoreboard">
            <X className="h-3 w-3" /> Exit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ScoreTile label="Company Total" value={formatCurrencyCompact(company.total)} />
        <ScoreTile label="New Money" value={formatCurrencyCompact(company.newMoney)} accent="text-green-400" />
        <ScoreTile label="Posted" value={formatCurrencyCompact(company.posted)} />
        <ScoreTile label="Goal" value={formatCurrencyCompact(company.goal)} />
        <ScoreTile
          label="Needed for Goal"
          value={companyNeeded > 0 ? formatCurrencyCompact(companyNeeded) : "Goal hit!"}
          accent={companyNeeded > 0 ? "text-yellow-400" : "text-green-400"}
        />
      </div>

      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${companyProgress >= 100 ? "bg-green-500" : "bg-primary"}`}
          style={{ width: `${companyProgress}%` }}
        />
      </div>

      <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <table className="w-full text-lg">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
              <th className="py-4 pl-6 pr-3 font-medium">#</th>
              <th className="py-4 px-3 font-medium">Collector</th>
              <th className="py-4 px-3 font-medium text-right">Start</th>
              <th className="py-4 px-3 font-medium text-right">New Money</th>
              <th className="py-4 px-3 font-medium text-right">Posted</th>
              <th className="py-4 px-3 font-medium text-right">Pending</th>
              <th className="py-4 px-3 font-medium text-right">Total</th>
              <th className="py-4 px-3 font-medium text-right">Goal</th>
              <th className="py-4 px-3 font-medium text-right">Needed</th>
              <th className="py-4 pr-6 pl-3 font-medium" style={{ minWidth: 180 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-800/60 last:border-0" data-testid={`scoreboard-row-${r.id}`}>
                <td className="py-4 pl-6 pr-3 font-mono text-slate-400">
                  {i === 0 ? <Trophy className="h-5 w-5 text-yellow-400" /> : i + 1}
                </td>
                <td className="py-4 px-3 font-semibold">{r.name}</td>
                <td className="py-4 px-3 text-right font-mono text-slate-400">{formatCurrencyCompact(r.start)}</td>
                <td className="py-4 px-3 text-right font-mono text-green-400 font-semibold">{formatCurrencyCompact(r.newMoney)}</td>
                <td className="py-4 px-3 text-right font-mono">{formatCurrencyCompact(r.posted)}</td>
                <td className="py-4 px-3 text-right font-mono text-yellow-400/90">{formatCurrencyCompact(r.pending)}</td>
                <td className="py-4 px-3 text-right font-mono">{formatCurrencyCompact(r.total)}</td>
                <td className="py-4 px-3 text-right font-mono text-slate-400">{formatCurrency(r.goal)}</td>
                <td className="py-4 px-3 text-right font-mono">
                  {r.needed > 0 ? formatCurrencyCompact(r.needed) : <span className="text-green-400">Hit</span>}
                </td>
                <td className="py-4 pr-6 pl-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.progress >= 100 ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-10 text-right">{Math.round(r.progress)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-slate-500">
                  No collectors to show yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${accent || ""}`}>{value}</p>
    </div>
  );
}
