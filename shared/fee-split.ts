// A portfolio's fee schedule feePercentage (basis points, e.g. 6000 =
// 60.00%) is the share of each dollar collected that is owed back to the
// client who placed that portfolio -- a placement/remittance fee, not a
// commission the company charges. The company keeps the remainder. A
// portfolio with no fee schedule attached (or a fee schedule with no
// percentage set) keeps 100% of every payment, matching every calculation
// that existed before this concept did.
export type FeeScheduleLike = { id: string; feePercentage: number | null };
export type PortfolioLike = { id: string; feeScheduleId: string | null };
export type DebtorLike = { id: string; portfolioId: string };

export function feeBasisPoints(schedule: FeeScheduleLike | undefined | null): number {
  if (!schedule || schedule.feePercentage == null) return 0;
  return Math.max(0, Math.min(10000, schedule.feePercentage));
}

export function splitAmountByFee(grossCents: number, clientFeeBasisPoints: number): {
  companyAmount: number;
  clientAmount: number;
} {
  const clientAmount = Math.round((grossCents * clientFeeBasisPoints) / 10000);
  return { companyAmount: grossCents - clientAmount, clientAmount };
}

// debtorId -> that debtor's portfolio's client fee rate (0 if the portfolio
// has no fee schedule, or the debtor's portfolio can't be resolved).
export function buildDebtorFeeRateMap(
  debtors: DebtorLike[],
  portfolios: PortfolioLike[],
  feeSchedules: FeeScheduleLike[],
): Map<string, number> {
  const scheduleById = new Map(feeSchedules.map((f) => [f.id, f]));
  const portfolioById = new Map(portfolios.map((p) => [p.id, p]));
  const map = new Map<string, number>();
  for (const d of debtors) {
    const portfolio = portfolioById.get(d.portfolioId);
    const schedule = portfolio?.feeScheduleId ? scheduleById.get(portfolio.feeScheduleId) : undefined;
    map.set(d.id, feeBasisPoints(schedule));
  }
  return map;
}
