import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const AUTH_STORAGE_KEY = "debtmanager_auth";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast({ title: "App installed!", description: "You can now use Debt Manager Pro from your desktop." });
      }
      setDeferredPrompt(null);
    }
    setShowPwaPrompt(false);
    setLocation("/app");
  };

  const handleSkipInstall = () => {
    setShowPwaPrompt(false);
    setLocation("/app");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Signup failed",
          description: data.error || "Failed to create account",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Auto-login: save auth data to localStorage
      const authUser = {
        id: data.collector.id,
        email: data.collector.email,
        name: data.collector.name,
        role: data.collector.role,
        organizationId: data.organizationId,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

      toast({
        title: "Account created!",
        description: "Welcome to Debt Manager Pro. Let's get started.",
      });

      // Show PWA install prompt if available
      if (deferredPrompt) {
        setShowPwaPrompt(true);
      } else {
        setLocation("/app");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during signup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between text-primary-foreground">
        <div>
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-10 w-auto brightness-0 invert" />
          </Link>
        </div>
        <div>
          <h2 className="text-3xl font-bold mb-6">Start collecting more today</h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>14-day free trial with full access</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>No credit card required to start</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>Setup takes less than 5 minutes</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>Import your existing data easily</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>Cancel anytime, no questions asked</span>
            </li>
          </ul>
        </div>
        <div className="text-sm text-primary-foreground/70">
          Trusted by 500+ collection agencies nationwide
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <Link href="/">
              <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-4" />
            </Link>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>Start your 14-day free trial</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    placeholder="ABC Collections"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@abccollections.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-create-account">
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-4">
                By signing up, you agree to our{" "}
                <a href="#" className="underline">Terms of Service</a> and{" "}
                <a href="#" className="underline">Privacy Policy</a>
              </p>
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/" className="hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={showPwaPrompt} onOpenChange={setShowPwaPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install Desktop App
            </DialogTitle>
            <DialogDescription>
              Install Debt Manager Pro on your computer for faster access and offline capabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Quick access from your desktop
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Works offline for viewing data
              </li>
              <li className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Native app experience
              </li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSkipInstall} data-testid="button-skip-install">
              Maybe Later
            </Button>
            <Button onClick={handleInstallPwa} data-testid="button-install-pwa">
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
