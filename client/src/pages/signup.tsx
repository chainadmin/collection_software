import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { InstallButton } from "@/components/install-button";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, LockKeyhole, ShieldCheck, Users } from "lucide-react";

const PLANS = [
  { id: "starter", name: "Starter", price: 200, seats: 4, description: "For compact teams", features: ["4 collector seats", "Basic reporting", "Email support"] },
  { id: "growth", name: "Growth", price: 400, seats: 15, popular: true, description: "For scaling operations", features: ["15 collector seats", "Advanced analytics", "Priority support", "Custom workflows"] },
  { id: "agency", name: "Agency", price: 750, seats: 40, description: "For multi-team agencies", features: ["40 collector seats", "Full API access", "Dedicated support", "Custom integrations"] },
];

function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${inverse ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>
        <ShieldCheck className="h-5 w-5" />
      </span>
      <span className="text-sm font-extrabold leading-tight tracking-tight">
        Debt Manager
        <span className={`block text-xs font-semibold tracking-[0.18em] ${inverse ? "text-primary-foreground/70" : "text-primary"}`}>PRO</span>
      </span>
    </span>
  );
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const searchString = useSearch();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [createdUsername, setCreatedUsername] = useState("");
  const [welcomeEmailSent, setWelcomeEmailSent] = useState(false);
  const [formData, setFormData] = useState({ companyName: "", name: "", email: "", phone: "", password: "" });
  const initialPlan = new URLSearchParams(searchString).get("plan") || "growth";
  const [selectedPlan, setSelectedPlan] = useState(PLANS.some(p => p.id === initialPlan) ? initialPlan : "growth");

  useEffect(() => { const plan = new URLSearchParams(searchString).get("plan"); if (plan && PLANS.some(p => p.id === plan)) setSelectedPlan(plan); }, [searchString]);
  const change = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const validate = () => {
    if (Object.values(formData).some(value => !value)) { toast({ title: "Complete your details", description: "Each field is needed to create your secure workspace.", variant: "destructive" }); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { toast({ title: "Check your email", description: "Enter a valid work email address.", variant: "destructive" }); return false; }
    if (formData.password.length < 8) { toast({ title: "Choose a longer password", description: "Your password must be at least 8 characters.", variant: "destructive" }); return false; }
    return true;
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, plan: selectedPlan }) });
      const data = await response.json();
      if (!response.ok) { toast({ title: "Account not created", description: data.error || "Please try again.", variant: "destructive" }); return; }
      setCreatedUsername(data.collector.username || data.collector.email || formData.email);
      setWelcomeEmailSent(Boolean(data.welcomeEmailSent));
      setStep(3);
    } catch { toast({ title: "Connection issue", description: "We could not create your account. Please try again.", variant: "destructive" }); } finally { setIsLoading(false); }
  };
  const detail = PLANS.find(p => p.id === selectedPlan)!;
  const steps = ["Organization", "Plan", "Ready"];
  return <div className="public-shell public-grid min-h-[100dvh]">
    <div className="mx-auto grid min-h-[100dvh] max-w-7xl lg:grid-cols-[.83fr_1.17fr]">
      <aside className="hidden border-r border-primary-foreground/10 bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
        <Link href="/" aria-label="Debt Manager Pro home"><BrandLockup inverse /></Link>
        <div className="my-auto"><p className="public-kicker text-primary-foreground/60">A deliberate beginning</p><h1 className="public-display mt-5 text-5xl leading-[.95]">Set the operating standard from day one.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-primary-foreground/70">Your trial opens a real, full-access admin workspace. Bring your team in when you are ready.</p><div className="mt-12 space-y-5">{[["Secure by design","Role-based access and account-level audit trails."],["No billing surprise","14 days, no credit card, and a clear plan choice."],["Built for operations","Payment, portfolio, and collector work in one system."]].map(([title,copy])=><div key={title} className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary-foreground/80" /><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-primary-foreground/65">{copy}</p></div></div>)}</div></div>
        <p className="font-mono text-[10px] uppercase tracking-[.15em] text-primary-foreground/50">Debt Manager Pro / Admin onboarding</p>
      </aside>
      <main className="flex items-center justify-center p-5 py-10 md:p-10">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between"><Link href="/" className="lg:hidden" aria-label="Debt Manager Pro home"><BrandLockup /></Link><p className="public-kicker hidden text-muted-foreground lg:block">New agency workspace</p><Link href="/login" className="text-sm font-bold text-primary hover:underline">Log in</Link></div>
          <div className="mb-8 flex items-center gap-3">{steps.map((label,index) => <div key={label} className="flex items-center gap-3"><div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step > index + 1 ? "bg-primary text-primary-foreground" : step === index + 1 ? "border-2 border-primary text-primary" : "bg-muted text-muted-foreground"}`}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</div><span className={`hidden text-xs font-semibold sm:block ${step >= index + 1 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>{index < 2 && <span className="h-px w-5 bg-border sm:w-10" />}</div>)}</div>
          <Card className="border-border/90 bg-card/90 shadow-xl"><CardContent className="p-6 md:p-9">
            {step === 1 && <form onSubmit={(event) => { event.preventDefault(); if (validate()) setStep(2); }}><p className="public-kicker text-primary">Step 01 / Your operation</p><h2 className="public-display mt-3 text-4xl">Start with the essentials.</h2><p className="mt-3 text-sm text-muted-foreground">This creates your agency’s first administrator account.</p><div className="mt-8 grid gap-5"><Field label="Agency name" id="companyName" placeholder="Harborline Recovery" value={formData.companyName} change={change} test="input-company-name" /><Field label="Your name" id="name" placeholder="Morgan Lee" value={formData.name} change={change} test="input-name" /><Field label="Work email" id="email" type="email" placeholder="morgan@harborline.co" value={formData.email} change={change} test="input-email" /><Field label="Phone number" id="phone" type="tel" placeholder="(555) 555-0147" value={formData.phone} change={change} test="input-phone" /><Field label="Password" id="password" type="password" placeholder="Create a strong password" value={formData.password} change={change} test="input-password" /><p className="-mt-3 text-xs text-muted-foreground">Use 8 or more characters. You will use this password to enter your system.</p><Button type="submit" data-testid="button-next-step">Continue to plan <ArrowRight className="ml-2 h-4 w-4" /></Button></div><p className="mt-6 text-center text-xs text-muted-foreground">By continuing, you agree to the <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.</p></form>}
            {step === 2 && <form onSubmit={submit}><p className="public-kicker text-primary">Step 02 / Trial plan</p><h2 className="public-display mt-3 text-4xl">Choose your starting capacity.</h2><p className="mt-3 border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">Your 14-day trial includes full access. No credit card is required today.</p><div className="mt-7 grid gap-3">{PLANS.map(plan => <button type="button" key={plan.id} onClick={() => setSelectedPlan(plan.id)} aria-pressed={selectedPlan === plan.id} className={`plan-choice relative w-full rounded-xl border p-5 text-left ${selectedPlan === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/45"}`} data-testid={`plan-${plan.id}`}>{plan.popular && <span className="public-kicker absolute right-4 top-3 text-primary">Suggested</span>}<div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-lg bg-muted p-2 text-primary">{plan.id === "growth" ? <Users className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}</div><div><p className="font-bold">{plan.name} <span className="font-normal text-muted-foreground">— {plan.description}</span></p><p className="mt-2 text-xs text-muted-foreground">{plan.features.join(" · ")}</p></div></div><div className="text-right"><p className="text-xl font-extrabold">${plan.price}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">month after trial</p></div></div>{selectedPlan === plan.id && <CheckCircle2 className="absolute -left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-card text-primary" />}</button>)}</div><div className="mt-7 flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isLoading} data-testid="button-back"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button className="flex-1" type="submit" disabled={isLoading} data-testid="button-start-trial">{isLoading ? "Creating workspace…" : `Start ${detail.name} trial`}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></form>}
            {step === 3 && <div className="reveal-up text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-8 w-8" /></div><p className="public-kicker mt-6 text-primary">Workspace created</p><h2 className="public-display mt-3 text-4xl">Your admin system is ready.</h2><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">Your 14-day {detail.name} trial has started. {welcomeEmailSent ? `We emailed your sign-in details to ${formData.email}.` : "We could not send the confirmation email, so save the username shown below."}</p><div className="mt-7 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left"><p className="public-kicker text-muted-foreground">Administrator username</p><p className="mt-2 break-all font-mono text-sm font-bold text-foreground">{createdUsername}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Use the password you created during registration to log in.</p></div><div className="mt-6 grid gap-3"><InstallButton mode="admin" label="Download / install admin system" /><Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-open-system"><LockKeyhole className="mr-2 h-4 w-4" />Continue to admin login</Button></div><p className="mt-5 text-xs leading-5 text-muted-foreground">For security, Debt Manager Pro never sends or displays your password.</p></div>}
          </CardContent></Card>
          {step < 3 && <p className="mt-6 text-center text-sm text-muted-foreground"><Link href="/" className="hover:text-foreground hover:underline">Return to overview</Link></p>}
        </div>
      </main>
    </div>
  </div>;
}

function Field({ label, id, type = "text", placeholder, value, change, test }: { label: string; id: string; type?: string; placeholder: string; value: string; change: (e: React.ChangeEvent<HTMLInputElement>) => void; test: string }) {
  const autoComplete = id === "companyName" ? "organization" : id === "password" ? "new-password" : id;
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} name={id} type={type} autoComplete={autoComplete} className="mt-2 bg-background" placeholder={placeholder} value={value} onChange={change} required minLength={id === "password" ? 8 : undefined} data-testid={test} /></div>;
}