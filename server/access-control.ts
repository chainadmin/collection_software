/** Pure guard used before treating a session as a global-admin session. */
export function isActiveGlobalAdminSession(
  sessionAdminId: string | undefined,
  liveAdmin: { id: string; isActive: boolean | null } | undefined,
): boolean {
  return !!sessionAdminId && !!liveAdmin &&
    liveAdmin.id === sessionAdminId && liveAdmin.isActive === true;
}