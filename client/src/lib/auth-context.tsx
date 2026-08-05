import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

const AUTH_STORAGE_KEY = "debtmanager_auth";
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
      // home screen, not navigated within an existing session).
      const isStandalone =
        typeof window !== "undefined" &&
        window.matchMedia != null &&
        window.matchMedia("(display-mode: standalone)").matches;

      if (isStandalone && !sessionStorage.getItem(PWA_SESSION_KEY)) {
        // Mark this session so subsequent in-app navigations are unaffected.
        sessionStorage.setItem(PWA_SESSION_KEY, "1");
        // Invalidate the server session silently.
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Ignore network errors — the local state clear below is what matters.
        }
        // Clear only the auth hint; preserve appMode (needed for routing to the
        // correct login page) and collector_agency_code (pre-fills the form).
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
        setIsLoading(false);
        return;
      }

      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/session");
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
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } else if (data.type === "globalAdmin" && data.admin) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      }

      setIsLoading(false);
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
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
    const response = await fetch("/api/auth/collector-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
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
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
    }
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // Clear collector mode flag too so the next login on this browser
    // (admin or collector) starts from a clean slate.
    localStorage.removeItem("appMode");
  };

  const setAuthUser = (authUser: AuthUser) => {
    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
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
