import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Headphones } from "lucide-react";

export default function CollectorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { collectorLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [agencyCode, setAgencyCode] = useState(() => localStorage.getItem("collector_agency_code") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const trimmedCode = agencyCode.trim().toLowerCase();
      localStorage.setItem("collector_agency_code", trimmedCode);
      const success = await collectorLogin(username, password, trimmedCode);
      if (success) {
        toast({
          title: "Welcome!",
          description: "You have been logged in successfully.",
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        setLocation("/app/workstation");
      } else {
        toast({
          title: "Login failed",
          description: "Invalid username or password.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Access Denied",
        description: error.message || "An error occurred during login.",
        variant: "destructive",
      });
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
                  data-testid="input-agency-code"
                />
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
