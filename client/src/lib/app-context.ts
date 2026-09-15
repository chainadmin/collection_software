// Which account type (admin/office app vs collector workstation app) this
// browser window/tab is signed in as. Stored in sessionStorage rather than
// localStorage because it must NOT be shared between windows — the whole
// point is that an admin PWA window and a collector PWA window on the same
// computer stay independently logged in, and sessionStorage is scoped per
// window/tab while localStorage is shared by every window on the origin.
//
// The server keys off the X-App-Context header (added to every request in
// queryClient.ts) to decide which of its two session cookies applies to a
// given request — see server/index.ts.

export type AppContext = "admin" | "collector";

const APP_CONTEXT_KEY = "app_context";

export function getAppContext(): AppContext {
  try {
    const stored = sessionStorage.getItem(APP_CONTEXT_KEY);
    if (stored === "admin" || stored === "collector") return stored;
  } catch {
    // sessionStorage unavailable (e.g. privacy mode) — fall through to the
    // URL-based inference below without persisting it.
  }

  // A fresh window that hasn't logged in yet: infer from the entry URL, the
  // same way index.html picks which PWA manifest to link.
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const inferred: AppContext =
    path.startsWith("/collector-login") || path.startsWith("/collector-install") ? "collector" : "admin";

  setAppContext(inferred);
  return inferred;
}

export function setAppContext(context: AppContext) {
  try {
    sessionStorage.setItem(APP_CONTEXT_KEY, context);
  } catch {
    // Ignore — worst case this window re-infers from the URL next call.
  }
}

// Namespaced per app context rather than one shared localStorage key, so an
// admin window's cached identity survives a collector logging in on this
// same computer in another window, and vice versa.
export function authStorageKey(): string {
  return `debtmanager_auth_${getAppContext()}`;
}
