import type { DashboardStats, Debtor, Payment, Portfolio } from "./schema";

export const POSTED_PAYMENT_STATUSES = new Set(["posted"]);

export function dashboardDateBounds(dateRange = "this_month", now = new Date()) {
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dateRange === "today") return { startDate: endDate, endDate };
  if (dateRange === "this_week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else if (dateRange === "this_quarter") start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
  else if (dateRange === "this_year") start.setUTCMonth(0, 1);
  else start.setUTCDate(1);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

export function calculateDashboardStats(
  debtors: Debtor[], payments: Payment[], portfolios: Portfolio[], dateRange?: string, now = new Date(),
): DashboardStats {
  const today = now.toISOString().slice(0, 10);
  const { startDate, endDate } = dashboardDateBounds(dateRange, now);
  const posted = payments.filter((payment) => POSTED_PAYMENT_STATUSES.has(payment.status));
  const pending = payments.filter((payment) => payment.status === "pending" && !payment.completedAt);
  const inRange = posted.filter((payment) => payment.paymentDate >= startDate && payment.paymentDate <= endDate);
  const portfolioFaceValue = portfolios.reduce((sum, portfolio) => sum + Number(portfolio.totalFaceValue || 0), 0);
  const accountFaceValue = debtors.reduce((sum, debtor) => sum + Number(debtor.originalBalance || 0), 0);
  const totalPortfolioValue = accountFaceValue || portfolioFaceValue;
  const totalCollected = inRange.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const declined = payments.filter((payment) => payment.status === "declined" || payment.status === "failed").length;
  const reversedPayments = payments.filter((payment) => payment.status === "reversed").length;
  const attempted = payments.filter((payment) => ["processed", "posted", "declined", "failed", "reversed"].includes(payment.status)).length;
  return {
    collectionsToday: posted.filter((payment) => payment.paymentDate === today).reduce((sum, payment) => sum + payment.amount, 0),
    collectionsThisMonth: totalCollected,
    activeAccounts: debtors.filter((debtor) => !["settled", "closed"].includes(debtor.status)).length,
    accountsInPayment: debtors.filter((debtor) => ["in_payment", "payments_pending", "promise"].includes(debtor.status)).length,
    recoveryRate: totalPortfolioValue ? totalCollected / totalPortfolioValue : 0,
    avgCollectionAmount: inRange.length ? totalCollected / inRange.length : 0,
    totalPortfolioValue,
    totalCollected,
    pendingPaymentCount: pending.length,
    pendingPaymentAmount: pending.reduce((sum, payment) => sum + payment.amount, 0),
    postedPaymentCount: inRange.length,
    postedPaymentAmount: totalCollected,
    reversedAccounts: debtors.filter((debtor) => debtor.status === "nsf").length,
    reversedPayments,
    declineRate: attempted ? (declined + reversedPayments) / attempted : 0,
  };
}
