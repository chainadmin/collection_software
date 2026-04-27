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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
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
