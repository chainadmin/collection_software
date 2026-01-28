import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Download, CreditCard, Building2, Users, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
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
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expirationDate: "",
    cardCode: "",
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

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    const name = e.target.name;

    if (name === "cardNumber") {
      value = value.replace(/\D/g, "").slice(0, 16);
      value = value.replace(/(.{4})/g, "$1 ").trim();
    } else if (name === "expirationDate") {
      value = value.replace(/\D/g, "").slice(0, 4);
      if (value.length >= 2) {
        value = value.slice(0, 2) + "/" + value.slice(2);
      }
    } else if (name === "cardCode") {
      value = value.replace(/\D/g, "").slice(0, 4);
    }

    setPaymentData({ ...paymentData, [name]: value });
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
    return true;
  };

  const validateStep3 = () => {
    const cardNum = paymentData.cardNumber.replace(/\s/g, "");
    if (cardNum.length < 13 || cardNum.length > 16) {
      toast({ title: "Invalid card number", description: "Please enter a valid card number", variant: "destructive" });
      return false;
    }
    if (paymentData.expirationDate.length !== 5) {
      toast({ title: "Invalid expiration", description: "Please enter expiration as MM/YY", variant: "destructive" });
      return false;
    }
    if (paymentData.cardCode.length < 3) {
      toast({ title: "Invalid CVV", description: "Please enter a valid security code", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsLoading(true);

    try {
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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

      const billingResponse = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: signupData.organizationId,
          plan: selectedPlan,
          cardNumber: paymentData.cardNumber.replace(/\s/g, ""),
          expirationDate: paymentData.expirationDate.replace("/", ""),
          cardCode: paymentData.cardCode,
          email: formData.email,
        }),
      });

      const billingData = await billingResponse.json();

      if (!billingResponse.ok) {
        toast({
          title: "Payment failed",
          description: billingData.error || "Failed to process payment. Please check your card details.",
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
        title: "Account created!",
        description: `Welcome to Debt Manager Pro. Your ${selectedPlan} subscription is now active.`,
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
          <h2 className="text-3xl font-bold mb-6">Start collecting more today</h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <CheckCircle className="h-6 w-6 shrink-0" />
              <span>Professional debt collection software</span>
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
              <span>Secure payment processing</span>
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
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8 lg:hidden">
            <Link href="/">
              <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-4" />
            </Link>
          </div>

          <div className="flex justify-center mb-6 gap-2">
            {[1, 2, 3].map((s) => (
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
                {step === 3 && "Payment Details"}
              </CardTitle>
              <CardDescription>
                {step === 1 && "Enter your company information"}
                {step === 2 && "Select the plan that fits your team"}
                {step === 3 && "Secure payment to activate your subscription"}
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
                <div className="space-y-4">
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
                            <div className="text-xs text-muted-foreground">/month</div>
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
                    <Button type="button" variant="outline" onClick={handleBack} data-testid="button-back">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="button" className="flex-1" onClick={handleNext} data-testid="button-next-step">
                      Continue to Payment
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{selectedPlanDetails?.name} Plan</p>
                        <p className="text-sm text-muted-foreground">{selectedPlanDetails?.seats} collector seats</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${selectedPlanDetails?.price}</p>
                        <p className="text-xs text-muted-foreground">/month</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cardNumber"
                        name="cardNumber"
                        placeholder="4111 1111 1111 1111"
                        value={paymentData.cardNumber}
                        onChange={handlePaymentChange}
                        className="pl-10"
                        required
                        data-testid="input-card-number"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expirationDate">Expiration</Label>
                      <Input
                        id="expirationDate"
                        name="expirationDate"
                        placeholder="MM/YY"
                        value={paymentData.expirationDate}
                        onChange={handlePaymentChange}
                        required
                        data-testid="input-expiration"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCode">CVV</Label>
                      <Input
                        id="cardCode"
                        name="cardCode"
                        placeholder="123"
                        value={paymentData.cardCode}
                        onChange={handlePaymentChange}
                        required
                        data-testid="input-cvv"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-center pt-2">
                    <CreditCard className="inline h-3 w-3 mr-1" />
                    Payments are securely processed via Authorize.net
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} data-testid="button-back">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading} data-testid="button-subscribe">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Subscribe for ${selectedPlanDetails?.price}/mo
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
