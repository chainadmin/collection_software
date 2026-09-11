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

test("dashboard date bounds use Monday and selected periods", () => {
  assert.deepEqual(dashboardDateBounds("this_week", new Date("2026-09-11T12:00:00Z")), {
    startDate: "2026-09-07", endDate: "2026-09-11",
  });
  assert.equal(dashboardDateBounds("this_quarter", new Date("2026-09-11T12:00:00Z")).startDate, "2026-07-01");
});
