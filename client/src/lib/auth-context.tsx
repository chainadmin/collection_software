import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAppContext, setAppContext, authStorageKey } from "./app-context";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  collectorLogin: (username: string, password: string, agencyCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAuthUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// sessionStorage key that marks an active PWA session. sessionStorage is
// cleared when the PWA process is fully terminated (icon closed), but survives
// in-app page navigations and device lock/unlock — so it correctly
// distinguishes a cold launch from ordinary in-app navigation.
const PWA_SESSION_KEY = "pwa_cold_launch_cleared";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      // Detect a cold PWA launch: running in standalone display-mode AND the
      // per-session flag is absent (meaning the app was just opened from the
      // home screen, not navigated within an existing session). A child
      // window opened via a same-origin link (e.g. "Team Scoreboard" opening
      // in a new tab) is not a cold launch even though its own sessionStorage
      // starts empty — window.opener is only ever set for that case, never
      // for a genuine OS/home-screen launch, so it rules those out.
      const isStandalone =
        typeof window !== "undefined" &&
        window.matchMedia != null &&
        window.matchMedia("(display-mode: standalone)").matches;
      const hasOpener = typeof window !== "undefined" && !!window.opener;

      if (isStandalone && !hasOpener && !sessionStorage.getItem(PWA_SESSION_KEY)) {
        // Mark this session so subsequent in-app navigations are unaffected.
        sessionStorage.setItem(PWA_SESSION_KEY, "1");
        // Invalidate the server session silently.
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "X-App-Context": getAppContext() },
          });
        } catch {
          // Ignore network errors — the local state clear below is what matters.
        }
        // Clear only the auth hint; preserve appMode (needed for routing to the
        // correct login page) and collector_agency_code (pre-fills the form).
        localStorage.removeItem(authStorageKey());
        setUser(null);
        setIsLoading(false);
        return;
      }

      const stored = localStorage.getItem(authStorageKey());
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          headers: { "X-App-Context": getAppContext() },
        });
        const data = await response.json();

        if (data.type === "collector" && data.collector) {
          const authUser: AuthUser = {
            id: data.collector.id,
            email: data.collector.email,
            name: data.collector.name,
            role: data.collector.role,
            organizationId: data.collector.organizationId,
          };
          setUser(authUser);
          localStorage.setItem(authStorageKey(), JSON.stringify(authUser));
        } else if (data.type === "globalAdmin" && data.admin) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        } else {
          localStorage.removeItem(authStorageKey());
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem(authStorageKey());
        setUser(null);
      }

      setIsLoading(false);
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // This window is now the admin app, regardless of what it inferred
      // from the URL — pins it before the request so the login call itself
      // (and everything after it) uses the admin session cookie.
      setAppContext("admin");
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-App-Context": "admin" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const authUser: AuthUser = {
          id: data.collector?.id || data.id,
          email: data.collector?.email || email,
          name: data.collector?.name || data.name,
          role: data.collector?.role || data.role,
          organizationId: data.organizationId,
        };
        setUser(authUser);
        localStorage.setItem(authStorageKey(), JSON.stringify(authUser));
        // Admin login clears any leftover collector mode flag from a
        // previous collector session on this browser, so the admin app
        // doesn't get redirected to the collector workstation.
        localStorage.removeItem("appMode");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const collectorLogin = async (username: string, password: string, agencyCode: string): Promise<boolean> => {
    // This window is now the collector app — pins it before the request so
    // the login call itself (and everything after it) uses the collector
    // session cookie, independent of any admin session on this computer.
    setAppContext("collector");
    const response = await fetch("/api/auth/collector-login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Context": "collector" },
      body: JSON.stringify({ username, password, agencyCode }),
    });

    if (response.ok) {
      const data = await response.json();
      const authUser: AuthUser = {
        id: data.collector?.id || data.id,
        email: data.collector?.email || "",
        name: data.collector?.name || data.name,
        role: data.collector?.role || data.role,
        organizationId: data.organizationId,
      };
      setUser(authUser);
      localStorage.setItem(authStorageKey(), JSON.stringify(authUser));
      localStorage.setItem("appMode", "collector");
      return true;
    }

    let payload: { code?: string; error?: string } = {};
    try {
      payload = await response.json();
    } catch {
      // ignore — fall back to a generic message below
    }
    const err = new Error(payload.error || "We couldn't sign you in. Please try again.") as Error & {
      code?: string;
      status?: number;
    };
    err.code = payload.code;
    err.status = response.status;
    throw err;
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-App-Context": getAppContext() },
      });
    } catch (e) {
    }
    setUser(null);
    localStorage.removeItem(authStorageKey());
    // Keep appMode across logout. It identifies which installed app initiated
    // the session, so AppContent can return a collector to the collector login
    // instead of briefly redirecting them through the admin login. A
    // successful admin login explicitly clears a stale collector mode above.
  };

  const setAuthUser = (authUser: AuthUser) => {
    setUser(authUser);
    localStorage.setItem(authStorageKey(), JSON.stringify(authUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        collectorLogin,
        logout,
        setAuthUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
