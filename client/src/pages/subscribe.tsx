import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ExternalLink,
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
  const [verifying, setVerifying] = useState(false);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");

    if (sessionId && !verifying) {
      setVerifying(true);
      fetch(`/api/billing/checkout-success?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
            toast({
              title: "Subscription activated!",
              description: `Your ${data.plan} plan is now active.`,
            });
            window.history.replaceState({}, "", "/subscribe");
          } else {
            toast({
              title: "Verification failed",
              description: data.error || "Could not verify payment. Please contact support.",
              variant: "destructive",
            });
          }
        })
        .catch(() => {
          toast({
            title: "Verification error",
            description: "Could not verify payment. Please contact support.",
            variant: "destructive",
          });
        })
        .finally(() => setVerifying(false));
    }

    if (canceled) {
      toast({
        title: "Payment canceled",
        description: "You can try again whenever you're ready.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/subscribe");
    }
  }, []);

  const subscribeMutation = useMutation({
    mutationFn: async (data: { plan: string }) => {
      const res = await apiRequest("POST", "/api/billing/subscribe", {
        organizationId: user?.organizationId,
        plan: data.plan,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
        toast({
          title: "Subscription activated!",
          description: `Your ${selectedPlan} plan is now active.`,
        });
        setLocation("/app");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    subscribeMutation.mutate({ plan: selectedPlan });
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

  if (subLoading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          {verifying && <p className="text-muted-foreground">Verifying your payment...</p>}
        </div>
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
                Subscribe to {selectedPlanDetails?.name}
              </CardTitle>
              <CardDescription>
                ${selectedPlanDetails?.price}/month · You'll be redirected to Stripe for secure payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={subscribeMutation.isPending}
                data-testid="button-subscribe"
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Subscribe for ${selectedPlanDetails?.price}/mo
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Payments are securely processed via Stripe
              </p>
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
