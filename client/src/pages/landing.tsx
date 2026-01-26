import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import {
  Shield,
  CreditCard,
  Users,
  BarChart3,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  DollarSign,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-10 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" data-testid="button-login">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button data-testid="button-get-started">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">Enterprise Debt Collection Software</Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Streamline Your Debt Collection Operations
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Powerful, secure, and compliant debt collection management software designed for agencies of all sizes. Manage portfolios, process payments, and maximize recoveries.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="gap-2" data-testid="button-start-trial">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" data-testid="button-schedule-demo">
                  Schedule Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Collection Agencies</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">$2B+</div>
              <div className="text-sm text-muted-foreground mt-1">Debt Collected</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">99.9%</div>
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">35%</div>
              <div className="text-sm text-muted-foreground mt-1">Avg. Collection Increase</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Collect More</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed specifically for debt collection agencies
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <DollarSign className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Payment Processing</CardTitle>
                <CardDescription>
                  Integrated payment runner with NMI and USAePay support. Process ACH, credit cards, and checks seamlessly.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Collector Management</CardTitle>
                <CardDescription>
                  Track collector performance, hourly wages, and productivity. Role-based permissions keep your team organized.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Portfolio Analytics</CardTitle>
                <CardDescription>
                  Real-time liquidation tracking, portfolio performance metrics, and comprehensive reporting dashboards.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Phone className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Click-to-Call</CardTitle>
                <CardDescription>
                  One-click dialing with call outcome tracking. Log connected, voicemail, no answer, and promise outcomes instantly.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Import/Export</CardTitle>
                <CardDescription>
                  Flexible data import with custom field mapping. Export recalls, remittances, and reports with ease.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Compliance Built-In</CardTitle>
                <CardDescription>
                  FDCPA, GLBA, and TCPA compliant. Audit trails, secure card storage, and IP whitelisting included.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Built for the Way Collectors Work
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">Collector Workstation</div>
                    <div className="text-sm text-muted-foreground">
                      Dedicated interface optimized for high-volume calling and account work
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">Auto-Save Notes</div>
                    <div className="text-sm text-muted-foreground">
                      Notes save automatically as you type - never lose important account information
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">Payment Calculator</div>
                    <div className="text-sm text-muted-foreground">
                      Instant settlement and payment plan calculations at your fingertips
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <div className="font-medium">SMS/TXT Integration</div>
                    <div className="text-sm text-muted-foreground">
                      Connect with external SMS providers for compliant text messaging campaigns
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-6 shadow-lg">
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <div className="text-center">
                  <Zap className="h-12 w-12 text-primary mx-auto mb-2" />
                  <div className="text-lg font-medium">Workstation Preview</div>
                  <div className="text-sm text-muted-foreground">Schedule a demo to see it in action</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">
              No hidden fees. No long-term contracts. Pay only for what you use.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Starter</CardTitle>
                <CardDescription>For small agencies getting started</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Up to 5 collector seats</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> 10,000 accounts</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Payment processing</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Basic reporting</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Email support</li>
                </ul>
                <Link href="/signup?plan=starter">
                  <Button className="w-full mt-6" variant="outline">Start Free Trial</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader>
                <Badge className="w-fit mb-2">Most Popular</Badge>
                <CardTitle>Professional</CardTitle>
                <CardDescription>For growing collection operations</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$299</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Up to 25 collector seats</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Unlimited accounts</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Payment processing</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Advanced reporting</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> SMS/TXT integration</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Priority support</li>
                </ul>
                <Link href="/signup?plan=professional">
                  <Button className="w-full mt-6">Start Free Trial</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>For large-scale operations</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Unlimited collector seats</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Unlimited accounts</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Multi-organization</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> API access</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Custom integrations</li>
                  <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Dedicated support</li>
                </ul>
                <Link href="/contact">
                  <Button className="w-full mt-6" variant="outline">Contact Sales</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="contact" className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Collect More?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join hundreds of collection agencies already using Debt Manager Pro to increase recoveries and streamline operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="gap-2">
                Start Your Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Schedule a Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <img src="/logo.png" alt="Debt Manager Pro" className="h-8 w-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Professional debt collection software for agencies of all sizes.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link href="/demo" className="hover:text-foreground">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#contact" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Debt Manager Pro. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" /> FDCPA Compliant
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" /> SOC 2 Type II
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
