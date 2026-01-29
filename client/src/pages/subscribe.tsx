import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CreditCard, 
  Building2, 
  Users, 
  Check, 
  Loader2, 
  AlertTriangle,
  Clock,
  CheckCircle,
} from "lucide-react";
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
    features: ["40 collector seats", "Full API access", "Dedicated support", "White-label options"],
  },
];

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expirationDate: "",
    cardCode: "",
  });

  const auth = localStorage.getItem(AUTH_STORAGE_KEY);
  const user = auth ? JSON.parse(auth) : null;

  const { data: subscription, isLoading: subLoading } = useQuery<{
    plan: string;
    status: string;
    trialEndDate: string | null;
    isTrialExpired: boolean;
    daysRemaining: number;
    seatLimit: number;
    isActive: boolean;
  }>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!user?.organizationId,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { plan: string; cardNumber: string; expirationDate: string; cardCode: string }) => {
      return apiRequest("POST", "/api/billing/subscribe", {
        organizationId: user?.organizationId,
        plan: data.plan,
        cardNumber: data.cardNumber.replace(/\s/g, ""),
        expirationDate: data.expirationDate.replace("/", ""),
        cardCode: data.cardCode,
        email: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({
        title: "Subscription activated!",
        description: `Your ${selectedPlan} plan is now active.`,
      });
      setLocation("/app");
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process payment. Please check your card details.",
        variant: "destructive",
      });
    },
  });

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

  const validatePayment = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePayment()) return;
    
    subscribeMutation.mutate({
      plan: selectedPlan,
      ...paymentData,
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Session Expired</CardTitle>
            <CardDescription>Please log in to manage your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full" data-testid="button-login">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedPlanDetails = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-6" />
          </Link>
          
          {subscription?.isTrialExpired ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 inline-flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="text-left">
                <p className="font-medium text-destructive">Your trial has expired</p>
                <p className="text-sm text-muted-foreground">Subscribe now to continue using Debt Manager Pro</p>
              </div>
            </div>
          ) : subscription?.status === "trial" ? (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 inline-flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">{subscription.daysRemaining} days left in your trial</p>
                <p className="text-sm text-muted-foreground">Subscribe now to avoid any interruption</p>
              </div>
            </div>
          ) : subscription?.status === "active" ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 inline-flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-green-600">Your subscription is active</p>
                <p className="text-sm text-muted-foreground">You're on the {subscription.plan} plan</p>
              </div>
            </div>
          ) : null}

          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">Select the plan that works best for your team</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {PLANS.map((plan) => (
            <Card 
              key={plan.id}
              className={`cursor-pointer transition-all hover-elevate ${
                selectedPlan === plan.id ? "border-primary ring-2 ring-primary/20" : ""
              }`}
              onClick={() => setSelectedPlan(plan.id)}
              data-testid={`card-plan-${plan.id}`}
            >
              <CardHeader className="text-center relative">
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>
                )}
                <div className={`mx-auto p-3 rounded-full mb-2 ${
                  selectedPlan === plan.id ? "bg-primary/10" : "bg-muted"
                }`}>
                  {plan.id === "starter" && <Building2 className="h-6 w-6" />}
                  {plan.id === "growth" && <Users className="h-6 w-6" />}
                  {plan.id === "agency" && <Building2 className="h-6 w-6" />}
                </div>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.seats} collector seats</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {selectedPlan === plan.id && (
                  <div className="mt-4 pt-4 border-t">
                    <Badge variant="secondary" className="w-full justify-center">Selected</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {subscription?.status !== "active" && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
              <CardDescription>
                Subscribe to the {selectedPlanDetails?.name} plan for ${selectedPlanDetails?.price}/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={subscribeMutation.isPending}
                  data-testid="button-subscribe"
                >
                  {subscribeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Subscribe for ${selectedPlanDetails?.price}/mo</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Payments are securely processed via Authorize.net
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {subscription?.status === "active" && (
          <div className="text-center">
            <Link href="/app">
              <Button size="lg" data-testid="button-go-to-app">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-8">
          <Link href="/app" className="hover:underline">
            Back to app
          </Link>
          {" · "}
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
