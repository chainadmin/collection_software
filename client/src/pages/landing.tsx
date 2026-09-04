import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/install-button";
import { Link } from "wouter";
import { ArrowRight, BarChart3, Check, FileText, LockKeyhole, Phone, ShieldCheck, Users, WalletCards } from "lucide-react";
import workstationPreview from "@/assets/images/workstation-preview.png";

const plans = [
  { id: "starter", name: "Starter", price: "$200", seats: "Includes 4 seats", extra: "+$25/seat up to 10 seats", note: "For small teams" },
  { id: "growth", name: "Growth", price: "$400", seats: "Includes 15 seats", extra: "+$20/seat up to 30 seats", note: "For growing agencies", featured: true },
  { id: "agency", name: "Agency", price: "$750", seats: "Includes 40 seats", extra: "+$15/seat after", note: "For large operations" },
];

function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <span className="text-sm font-extrabold leading-tight tracking-tight">
        Debt Manager
        <span className="block text-xs font-semibold tracking-[0.18em] text-primary">PRO</span>
      </span>
    </span>
  );
}

export default function Landing() {
  return <div className="public-shell min-h-[100dvh] overflow-hidden">
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Debt Manager Pro home"><BrandLockup /></Link>
        <nav className="hidden items-center gap-7 md:flex"><a href="#operations" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Operations</a><a href="#security" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Control</a><a href="#pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Pricing</a></nav>
        <div className="flex items-center gap-2"><ThemeToggle /><Link href="/login" className="hidden sm:block"><Button variant="ghost" data-testid="button-login">Log in</Button></Link><Link href="/signup"><Button data-testid="button-get-started">Start trial <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></div>
      </div>
    </header>

    <main>
      <section className="public-grid relative border-b border-border/70">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-16 md:pb-24 md:pt-28 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
          <div className="reveal-up">
            <p className="public-kicker mb-6 flex items-center gap-3 text-primary"><span className="h-px w-8 bg-primary" />Collection operations, in command</p>
            <h1 className="public-display max-w-3xl text-5xl leading-[.91] text-foreground md:text-7xl">The calm center of your collection operation.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Debt Manager Pro gives agency leaders a clear line from portfolio to payment—without losing the account detail, controls, and accountability that matter.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/signup"><Button size="lg" className="w-full sm:w-auto" data-testid="button-start-trial">Start a 14-day trial <ArrowRight className="ml-2 h-4 w-4" /></Button></Link><Link href="/demo"><Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-schedule-demo">See the system</Button></Link></div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">No credit card required. Full access from day one.</p>
          </div>
          <div className="reveal-up-delay relative">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card p-2 shadow-2xl"><div className="flex items-center gap-2 border-b px-3 py-2"><span className="h-2 w-2 rounded-full bg-primary/55" /><span className="font-mono text-[10px] tracking-widest text-muted-foreground">LIVE WORKSTATION</span></div><img src={workstationPreview} alt="Debt Manager Pro workstation" className="w-full rounded-b-xl" data-testid="img-workstation-preview" /></div>
            <div className="absolute -bottom-4 -left-5 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-lg md:block"><p className="public-kicker text-muted-foreground">Activity status</p><p className="mt-1 text-sm font-bold">Every action, accounted for.</p></div>
          </div>
        </div>
      </section>

      <section id="operations" className="mx-auto max-w-7xl px-5 py-20 md:py-28">
        <div className="max-w-2xl"><p className="public-kicker text-primary">Built for accountable work</p><h2 className="public-display mt-4 text-4xl md:text-5xl">A complete operating picture, not another layer of software.</h2></div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-2 lg:grid-cols-3">
          {[[WalletCards,"Payments that reconcile","Run cards, ACH, and checks from the account record with a clean audit trail."],[Users,"Collectors with focus","Purpose-built account work, permissions, productivity, and wage tracking."],[BarChart3,"Portfolio intelligence","Liquidation, placement, and recovery data organized for decisions."],[Phone,"A call workflow that holds up","One-click dialing and outcome logging that keeps the next action clear."],[FileText,"Data in, control out","Bring in portfolios with mapping and export remittances with confidence."],[ShieldCheck,"Compliance in the flow","FDCPA, GLBA, and TCPA-minded controls embedded in daily work."]].map(([Icon,title,text]) => { const IconComponent = Icon as typeof WalletCards; return <div key={title as string} className="bg-card p-7 transition-colors hover:bg-accent/30"><IconComponent className="h-6 w-6 text-primary" /><h3 className="mt-7 text-lg font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p></div>})}
        </div>
      </section>

      <section id="security" className="bg-[hsl(var(--primary))] text-primary-foreground"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-[.85fr_1.15fr] md:py-28"><div><p className="public-kicker text-primary-foreground/65">Designed for sensitive work</p><h2 className="public-display mt-4 text-4xl leading-tight md:text-5xl">Control should feel built in—not bolted on.</h2></div><div className="grid gap-8 sm:grid-cols-2">{[["Role-aware access","Give people only the tools and records their role calls for."],["Traceable activity","Maintain a visible record of account movement, notes, and payments."],["Secure payment handling","Keep payment processing connected to operational safeguards."],["IP whitelisting","Set an additional boundary around the system your team depends on."]].map(([title,copy], i)=><div key={title} className="border-t border-primary-foreground/25 pt-5"><span className="font-mono text-xs text-primary-foreground/55">0{i+1}</span><h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-primary-foreground/70">{copy}</p></div>)}</div></div></section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-2 md:py-28"><div><p className="public-kicker text-primary">Workstation first</p><h2 className="public-display mt-4 text-4xl md:text-5xl">Give collectors a place to do deliberate work.</h2></div><div className="space-y-5">{["Notes that save as the conversation moves","Settlement and payment-plan calculations at the account level","Connected SMS workflows for compliant outreach","Recall, remittance, and reporting tools close at hand"].map(text=><div key={text} className="flex gap-4 border-b border-border pb-5"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" /><p className="font-medium">{text}</p></div>)}</div></section>

      <section id="pricing" className="border-y bg-muted/35"><div className="mx-auto max-w-7xl px-5 py-20 md:py-28"><div className="text-center"><p className="public-kicker text-primary">Straightforward scale</p><h2 className="public-display mt-4 text-4xl md:text-5xl">Every tier starts with the whole system.</h2><p className="mx-auto mt-4 max-w-xl text-muted-foreground">Choose the capacity that fits your agency. Your 14-day trial begins before billing.</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{plans.map(plan=><article key={plan.id} className={`relative rounded-2xl border p-7 ${plan.featured ? "border-primary bg-card shadow-xl" : "bg-card/60"}`} data-testid={`card-pricing-${plan.id}`}>{plan.featured && <span className="public-kicker absolute -top-3 left-6 bg-primary px-3 py-1 text-primary-foreground">Common choice</span>}<p className="text-sm text-muted-foreground">{plan.note}</p><h3 className="mt-2 text-2xl font-extrabold" data-testid={`text-tier-${plan.id}`}>{plan.name}</h3><div className="mt-7"><span className="public-display text-5xl" data-testid={`text-price-${plan.id}`}>{plan.price}</span><span className="text-muted-foreground"> / month</span></div><p className="mt-2 text-sm font-semibold" data-testid={`text-seats-${plan.id}`}>{plan.seats}</p><p className="mt-1 text-xs text-muted-foreground">{plan.extra}</p><ul className="mt-7 space-y-3 text-sm text-muted-foreground"><li>Unlimited accounts</li><li>Payment processing</li><li>Collector workstation</li><li>Full reporting</li></ul><Link href={`/signup?plan=${plan.id}`} className="mt-8 block"><Button className="w-full" variant={plan.featured ? "default" : "outline"} data-testid={`button-signup-${plan.id}`}>Select {plan.name}</Button></Link></article>)}</div></div></section>

      <section id="contact" className="mx-auto max-w-7xl px-5 py-20 md:py-28">
        <div className="overflow-hidden rounded-3xl bg-[hsl(var(--foreground))] px-6 py-12 text-[hsl(var(--background))] md:px-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="public-kicker opacity-60">Ready when your operation is</p>
              <h2 className="public-display mt-4 max-w-3xl text-4xl leading-tight md:text-6xl">
                Put every account, payment, and next action in clear view.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 opacity-70">
                Start with full access for 14 days, or talk with us first at{" "}
                <a className="font-semibold underline underline-offset-4" href="mailto:support@chainsoftwaregroup.com">
                  support@chainsoftwaregroup.com
                </a>.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="w-full" data-testid="button-final-start-trial">
                  Create your workspace <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full border-white/30 text-current hover:bg-white/10">
                  Request a demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="mx-auto max-w-7xl px-5 py-12"><div className="grid gap-9 md:grid-cols-[1.5fr_1fr_1fr]"><div><BrandLockup /><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">A serious operations system for agencies that need to know what happened, what is next, and who owns it.</p></div><div><p className="public-kicker text-muted-foreground">System</p><div className="mt-4 flex flex-col items-start gap-3 text-sm"><Link href="/demo">Request a demo</Link><InstallButton mode="admin" label="Install admin system" /><a href="/collector-install" data-testid="link-download-collector">Install collector app</a></div></div><div><p className="public-kicker text-muted-foreground">Contact</p><a href="mailto:support@chainsoftwaregroup.com" className="mt-4 block text-sm font-semibold">support@chainsoftwaregroup.com</a><p className="mt-7 text-xs text-muted-foreground">© 2026 Debt Manager Pro</p></div></div></footer>
  </div>;
}