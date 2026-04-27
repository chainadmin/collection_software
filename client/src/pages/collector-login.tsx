import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, Headphones, Info } from "lucide-react";

type LoginErrorState = {
  code?: string;
  title: string;
  message: string;
};

const ERROR_TITLES: Record<string, string> = {
  missing_fields: "Missing information",
  org_not_found: "We can't find that company code",
  org_inactive: "Organization not active",
  ip_blocked: "IP address not authorized",
  ip_invalid: "Couldn't verify your IP",
  invalid_credentials: "Sign-in failed",
  collector_inactive: "Account disabled",
};

// Mirrors the server-side normalizer so the user sees the same value that's
// actually used to look up the organization. Strips URLs and stray whitespace
// and lowercases the result.
function normalizeAgencyCodeInput(input: string): string {
  let s = (input ?? "").trim();
  if (!s) return "";

  const loginMatch = s.match(/\/login\/([^\/?#\s]+)/i);
  if (loginMatch) {
    s = loginMatch[1];
  } else if (/[\/?:#]/.test(s)) {
    const parts = s.split(/[\/?#]/).filter(Boolean);
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (last && !/^[a-z]+:$/i.test(last)) {
        s = last;
      }
    }
  }

  return s.trim().toLowerCase();
}

export default function CollectorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { collectorLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [agencyCode, setAgencyCode] = useState(() => localStorage.getItem("collector_agency_code") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<LoginErrorState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const normalizedCode = normalizeAgencyCodeInput(agencyCode);
    const trimmedUsername = username.trim();

    if (!normalizedCode || !trimmedUsername || !password) {
      setLoginError({
        code: "missing_fields",
        title: ERROR_TITLES.missing_fields,
        message: "Please fill in your company code, username, and password.",
      });
      return;
    }

    // Normalize the visible input so the user can see the slug we're actually
    // using for lookup (helps when they pasted a URL by accident).
    if (normalizedCode !== agencyCode) {
      setAgencyCode(normalizedCode);
    }

    setIsLoading(true);
    try {
      localStorage.setItem("collector_agency_code", normalizedCode);
      // collectorLogin throws on any non-OK response, so we only get here on
      // a successful sign-in.
      await collectorLogin(trimmedUsername, password, normalizedCode);
      toast({
        title: "Welcome!",
        description: "You have been logged in successfully.",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      setLocation("/app/workstation");
    } catch (error: any) {
      const code: string | undefined = error?.code;
      const title = (code && ERROR_TITLES[code]) || "Sign-in failed";
      const message =
        error?.message ||
        "Something went wrong while signing you in. Please try again in a moment.";
      setLoginError({ code, title, message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-4" />
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Headphones className="h-5 w-5 text-primary" />
              <CardTitle>Collector Workstation</CardTitle>
            </div>
            <CardDescription>Sign in with your agency code, username, and password</CardDescription>
          </CardHeader>
          <CardContent>
            {loginError && (
              <Alert
                variant="destructive"
                className="mb-4"
                data-testid={`alert-login-error-${loginError.code ?? "generic"}`}
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{loginError.title}</AlertTitle>
                <AlertDescription>{loginError.message}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agency-code">Agency Code</Label>
                <Input
                  id="agency-code"
                  type="text"
                  placeholder="e.g. acme-collections"
                  value={agencyCode}
                  onChange={(e) => setAgencyCode(e.target.value)}
                  required
                  autoComplete="organization"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-testid="input-agency-code"
                />
                <p
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                  data-testid="text-agency-code-hint"
                >
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    This is your company code — the same slug used in your{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/login/&lt;code&gt;</code>{" "}
                    URL. Super Admins can find it on the organization details page.
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signin">
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="hover:underline">
            Admin Login
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
