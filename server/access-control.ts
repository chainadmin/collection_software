/** Pure guard used before treating a session as a global-admin session. */
export function isActiveGlobalAdminSession(
  sessionAdminId: string | undefined,
  liveAdmin: { id: string; isActive: boolean | null } | undefined,
): boolean {
  return !!sessionAdminId && !!liveAdmin &&
    liveAdmin.id === sessionAdminId && liveAdmin.isActive === true;
}

/** Requires a current collector record, never the role retained in session. */
export function isActiveAdminOrManagerRecord(
  sessionCollector: { id?: string } | undefined,
  live: { id?: string; status?: string; organizationId?: string; role?: string } | undefined,
  orgId: string,
): boolean {
  return !!(
    sessionCollector?.id &&
    live &&
    live.id === sessionCollector.id &&
    live.status === "active" &&
    live.organizationId === orgId &&
    (live.role === "admin" || live.role === "manager")
  );
}

/** Allows payment operations only for active users explicitly trusted with them. */
export function canRunPaymentsRecord(
  sessionCollector: { id?: string } | undefined,
  live: {
    id?: string;
    status?: string;
    organizationId?: string;
    role?: string;
    canViewPaymentRunner?: boolean | null;
  } | undefined,
  orgId: string,
): boolean {
  return !!(
    sessionCollector?.id &&
    live &&
    live.id === sessionCollector.id &&
    live.status === "active" &&
    live.organizationId === orgId &&
    (live.role === "admin" || live.role === "manager" || live.canViewPaymentRunner === true)
  );
}

/**
 * Allows editing a pending payment's amount/date/method. This is a
 * dedicated grant, separate from Payment Runner access
 * (canRunPaymentsRecord) — an org can hand a collector the ability to
 * correct payment details without also giving them Payment Runner
 * access, and vice versa.
 */
export function canEditPaymentsRecord(
  sessionCollector: { id?: string } | undefined,
  live: {
    id?: string;
    status?: string;
    organizationId?: string;
    role?: string;
    canEditPayments?: boolean | null;
  } | undefined,
  orgId: string,
): boolean {
  return !!(
    sessionCollector?.id &&
    live &&
    live.id === sessionCollector.id &&
    live.status === "active" &&
    live.organizationId === orgId &&
    (live.role === "admin" || live.role === "manager" || live.canEditPayments === true)
  );
}

/**
 * An auditor is read-only everywhere except debtors (view/edit/notes), and
 * can optionally be locked to a single client's data. Returns null for
 * every other role (no auditor restriction applies at all). For an
 * auditor, clientId is the client to scope to, or null when the org left
 * them unrestricted (they see the whole org, e.g. an internal/QA auditor).
 */
export function auditorScopeRecord(
  sessionCollector: { id?: string } | undefined,
  live: {
    id?: string;
    status?: string;
    organizationId?: string;
    role?: string;
    assignedClientId?: string | null;
  } | undefined,
  orgId: string,
): { clientId: string | null } | null {
  const isLiveAuditor = !!(
    sessionCollector?.id &&
    live &&
    live.id === sessionCollector.id &&
    live.status === "active" &&
    live.organizationId === orgId &&
    live.role === "auditor"
  );
  if (!isLiveAuditor) return null;
  return { clientId: live!.assignedClientId ?? null };
}

/**
 * Allows viewing company financials: employee hourly wages, wage-cost/ROI
 * profitability reporting, and portfolio ROI. Deliberately NOT granted by
 * role=admin/manager alone - unlike every other permission here, this one
 * must be explicitly turned on per collector, so a collector promoted to
 * admin to help run operations doesn't automatically see pay and
 * profitability data unless the org chooses to share it with them.
 */
export function canViewFinancialsRecord(
  sessionCollector: { id?: string } | undefined,
  live: {
    id?: string;
    status?: string;
    organizationId?: string;
    canViewFinancials?: boolean | null;
  } | undefined,
  orgId: string,
): boolean {
  return !!(
    sessionCollector?.id &&
    live &&
    live.id === sessionCollector.id &&
    live.status === "active" &&
    live.organizationId === orgId &&
    live.canViewFinancials === true
  );
}
