import assert from "node:assert/strict";
import test from "node:test";
import { calculateDashboardStats, dashboardDateBounds } from "../shared/dashboard-metrics";
import type { Debtor, Payment, Portfolio } from "../shared/schema";

const debtor = (overrides: Partial<Debtor> = {}) => ({
  id: "debtor-1", organizationId: "org-1", portfolioId: "portfolio-1",
  accountNumber: "A1", firstName: "A", lastName: "Debtor", originalBalance: 10_000,
  currentBalance: 7_000, status: "payments_pending", ...overrides,
} as Debtor);

const payment = (id: string, status: string, amount: number, paymentDate: string, overrides: Partial<Payment> = {}) => ({
  id, organizationId: "org-1", debtorId: "debtor-1", amount, paymentDate,
  paymentMethod: "card", status, ...overrides,
} as Payment);

test("dashboard reports scheduled pending separately and counts only posted money as collected", () => {
  const payments = [
    payment("scheduled", "pending", 2_000, "2026-09-12"),
    payment("ran", "processed", 3_000, "2026-09-10", { completedAt: new Date("2026-09-10") }),
    payment("posted", "posted", 1_500, "2026-09-10", { completedAt: new Date("2026-09-10") }),
  ];
  const portfolio = { id: "portfolio-1", organizationId: "org-1", totalFaceValue: 0, status: "active" } as Portfolio;
  const stats = calculateDashboardStats([debtor()], payments, [portfolio], "this_month", new Date("2026-09-11T12:00:00Z"));

  assert.equal(stats.pendingPaymentCount, 1);
  assert.equal(stats.pendingPaymentAmount, 2_000);
  assert.equal(stats.postedPaymentCount, 1);
  assert.equal(stats.totalCollected, 1_500);
  assert.equal(stats.totalPortfolioValue, 10_000, "account face value replaces a stale zero portfolio total");
  assert.equal(stats.recoveryRate, 0.15);
});

test("dashboard date bounds use Monday, selected periods, and the true end of each period", () => {
  assert.deepEqual(dashboardDateBounds("this_week", new Date("2026-09-11T12:00:00Z")), {
    startDate: "2026-09-07", endDate: "2026-09-11", periodEnd: "2026-09-13",
  });
  assert.equal(dashboardDateBounds("this_quarter", new Date("2026-09-11T12:00:00Z")).startDate, "2026-07-01");
  assert.equal(dashboardDateBounds("this_quarter", new Date("2026-09-11T12:00:00Z")).periodEnd, "2026-09-30");
  assert.equal(dashboardDateBounds("this_month", new Date("2026-09-11T12:00:00Z")).periodEnd, "2026-09-30");
  assert.equal(dashboardDateBounds("this_year", new Date("2026-09-11T12:00:00Z")).periodEnd, "2026-12-31");
  assert.deepEqual(dashboardDateBounds("today", new Date("2026-09-11T12:00:00Z")), {
    startDate: "2026-09-11", endDate: "2026-09-11", periodEnd: "2026-09-11",
  });
});

test("pending money is scoped to the selected period, not every pending payment in the system", () => {
  const payments = [
    // Belongs to a prior month - must not inflate "this month"'s pending total.
    payment("old-pending", "pending", 9_999_99, "2026-07-15"),
    // Due later this same month - still counts toward "this month".
    payment("later-this-month", "pending", 2_000, "2026-09-25"),
    // Due today.
    payment("today-pending", "pending", 1_000, "2026-09-11"),
    // Scheduled for next month - must not count toward "this month" either.
    payment("next-month", "pending", 5_000, "2026-10-03"),
  ];
  const portfolio = { id: "portfolio-1", organizationId: "org-1", totalFaceValue: 0, status: "active" } as Portfolio;
  const now = new Date("2026-09-11T12:00:00Z");

  const monthStats = calculateDashboardStats([debtor()], payments, [portfolio], "this_month", now);
  assert.equal(monthStats.pendingPaymentCount, 2, "only the two payments due within September count");
  assert.equal(monthStats.pendingPaymentAmount, 3_000);

  const todayStats = calculateDashboardStats([debtor()], payments, [portfolio], "today", now);
  assert.equal(todayStats.pendingPaymentCount, 1, "only the payment due today counts for the whiteboard's today view");
  assert.equal(todayStats.pendingPaymentAmount, 1_000);
});
