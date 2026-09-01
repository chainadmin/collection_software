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