import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Download, Building2, Users, ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const AUTH_STORAGE_KEY = "debtmanager_auth";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 200,
    seats: 4,
    description: "Perfect for small agencies",
    features: ["4 collector seats", "Basic reporting", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 400,
    seats: 15,
    popular: true,
    description: "For growing teams",
    features: ["15 collector seats", "Advanced analytics", "Priority support", "Custom workflows"],
  },
  {
    id: "agency",
    name: "Agency",
    price: 750,
    seats: 40,
    description: "Enterprise-grade solution",
    features: ["40 collector seats", "Full API access", "Dedicated support", "White-label options", "Custom integrations"],
  },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  
  // Get plan from URL query param or default to growth
  const urlParams = new URLSearchParams(searchString);
  const initialPlan = urlParams.get("plan") || "growth";
  const [selectedPlan, setSelectedPlan] = useState(
    PLANS.some(p => p.id === initialPlan) ? initialPlan : "growth"
  );

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

  const validateStep1 = () => {
    if (!formData.companyName || !formData.name || !formData.email || !formData.phone || !formData.password) {
      toast({ title: "Missing information", description: "Please fill in all fields", variant: "destructive" });
      return false;
    }
    if (formData.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          plan: selectedPlan,
        }),
      });

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        toast({
          title: "Signup failed",
          description: signupData.error || "Failed to create account",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const authUser = {
        id: signupData.collector.id,
        email: signupData.collector.email,
        name: signupData.collector.name,
        role: signupData.collector.role,
        organizationId: signupData.organizationId,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

      toast({
        title: "Welcome to Debt Manager Pro!",
        description: `Your 14-day free trial has started. Enjoy full access to the ${selectedPlan} plan features.`,
      });

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

  const selectedPlanDetails = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen flex bg-muted/30">
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between text-primary-foreground">
        <div>
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-10 w-auto brightness-0 invert" />
          </Link>
        </div>
        <div>
          <h2 className="text-3xl font-bold mb-6">Start your 14-day free trial</h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>Full access to all features</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>No credit card required</span>
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
              <span>Cancel anytime during trial</span>
            </li>
          </ul>
        </div>
        <div className="text-sm text-primary-foreground/70">
          Trusted by 500+ collection agencies nationwide
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8 lg:hidden">
            <Link href="/">
              <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-4" />
            </Link>
          </div>

          <div className="flex justify-center mb-6 gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : s < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
            ))}
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>
                {step === 1 && "Create Your Account"}
                {step === 2 && "Choose Your Plan"}
              </CardTitle>
              <CardDescription>
                {step === 1 && "Enter your company information to get started"}
                {step === 2 && "Select the plan you'll use after your trial"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
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
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>
                  <Button type="button" className="w-full" onClick={handleNext} data-testid="button-next-step">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-sm">
                      <span className="font-medium">14-day free trial</span> - no credit card required. 
                      You can change your plan anytime.
                    </p>
                  </div>
                  
                  <div className="grid gap-4">
                    {PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                          selectedPlan === plan.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        data-testid={`plan-${plan.id}`}
                      >
                        {plan.popular && (
                          <Badge className="absolute -top-2 right-4" variant="default">
                            Most Popular
                          </Badge>
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selectedPlan === plan.id ? "bg-primary/10" : "bg-muted"}`}>
                              {plan.id === "starter" && <Building2 className="h-5 w-5" />}
                              {plan.id === "growth" && <Users className="h-5 w-5" />}
                              {plan.id === "agency" && <Building2 className="h-5 w-5" />}
                            </div>
                            <div>
                              <h3 className="font-semibold">{plan.name}</h3>
                              <p className="text-sm text-muted-foreground">{plan.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${plan.price}</div>
                            <div className="text-xs text-muted-foreground">/month after trial</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {plan.features.map((feature, idx) => (
                            <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                              {feature}
                            </span>
                          ))}
                        </div>
                        {selectedPlan === plan.id && (
                          <div className="absolute top-4 left-4">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} data-testid="button-back">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading} data-testid="button-start-trial">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Start Free Trial
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {step === 1 && (
                <>
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
                </>
              )}
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/" className="hover:underline">
              Back to home
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
              Skip for now
            </Button>
            <Button onClick={handleInstallPwa} data-testid="button-install-pwa">
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
