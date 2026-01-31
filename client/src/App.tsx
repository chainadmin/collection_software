import { useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { CollectorSidebar } from "@/components/collector-sidebar";
import { AccountSearch } from "@/components/account-search";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Workstation from "@/pages/workstation";
import Debtors from "@/pages/debtors";
import DebtorDetail from "@/pages/debtor-detail";
import PaymentRunner from "@/pages/payment-runner";
import Portfolios from "@/pages/portfolios";
import Collectors from "@/pages/collectors";
import Liquidation from "@/pages/liquidation";
import Settings from "@/pages/settings";
import Whiteboard from "@/pages/collector/whiteboard";
import Declines from "@/pages/collector/declines";
import LiqRates from "@/pages/collector/liq-rates";
import DropAccounts from "@/pages/admin/tools/drop";
import ImportExport from "@/pages/admin/tools/import-export";
import Recall from "@/pages/admin/tools/recall";
import Banko from "@/pages/admin/tools/banko";
import Consolidation from "@/pages/admin/tools/consolidation";
import Merchants from "@/pages/admin/payments/merchants";
import Remittance from "@/pages/admin/payments/remittance";
import ImportBatch from "@/pages/admin/payments/import-batch";
import EmailManage from "@/pages/admin/email/manage";
import EmailSettings from "@/pages/admin/email/settings";
import EmailTemplates from "@/pages/admin/email/templates";
import CompanyDashboard from "@/pages/admin/reporting/dashboard";
import CollectorReporting from "@/pages/admin/reporting/collectors";
import TimeClock from "@/pages/admin/reporting/time-clock";
import FeeSchedules from "@/pages/admin/settings/fees";
import ServerAccess from "@/pages/admin/settings/server-access";
import Clients from "@/pages/admin/clients";
import SuperAdmin from "@/pages/super-admin";
import SuperAdminLogin from "@/pages/super-admin-login";
import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";
import type { Collector, Debtor } from "@shared/schema";
import { OrganizationProvider } from "@/lib/organization-context";

function AppRouter() {
  return (
    <Switch>
      <Route path="/app" component={Dashboard} />
      <Route path="/app/workstation" component={Workstation} />
      <Route path="/app/debtors" component={Debtors} />
      <Route path="/app/debtors/:id" component={DebtorDetail} />
      <Route path="/app/payment-runner" component={PaymentRunner} />
      <Route path="/app/portfolios" component={Portfolios} />
      <Route path="/app/collectors" component={Collectors} />
      <Route path="/app/liquidation" component={Liquidation} />
      <Route path="/app/settings" component={Settings} />
      <Route path="/app/collector/whiteboard" component={Whiteboard} />
      <Route path="/app/collector/declines" component={Declines} />
      <Route path="/app/collector/liq-rates" component={LiqRates} />
      <Route path="/app/admin/tools/drop" component={DropAccounts} />
      <Route path="/app/admin/tools/import-export" component={ImportExport} />
      <Route path="/app/admin/tools/recall" component={Recall} />
      <Route path="/app/admin/tools/banko" component={Banko} />
      <Route path="/app/admin/tools/consolidation" component={Consolidation} />
      <Route path="/app/admin/payments/merchants" component={Merchants} />
      <Route path="/app/admin/payments/remittance" component={Remittance} />
      <Route path="/app/admin/payments/import-batch" component={ImportBatch} />
      <Route path="/app/admin/email/manage" component={EmailManage} />
      <Route path="/app/admin/email/settings" component={EmailSettings} />
      <Route path="/app/admin/email/templates" component={EmailTemplates} />
      <Route path="/app/admin/reporting/dashboard" component={CompanyDashboard} />
      <Route path="/app/admin/reporting/collectors" component={CollectorReporting} />
      <Route path="/app/admin/reporting/time-clock" component={TimeClock} />
      <Route path="/app/admin/settings/fees" component={FeeSchedules} />
      <Route path="/app/admin/settings/server-access" component={ServerAccess} />
      <Route path="/app/admin/settings" component={Settings} />
      <Route path="/app/admin/clients" component={Clients} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [location, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  
  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<{
    status: string;
    isTrialExpired: boolean;
    daysRemaining: number;
  }>({
    queryKey: ["/api/billing/subscription"],
    retry: false,
  });

  const currentCollector = collectors[0];
  const isCollectorRole = currentCollector?.role === "collector";

  // Redirect to subscribe page if trial expired and not active
  useEffect(() => {
    if (!subscriptionLoading && subscription?.isTrialExpired && subscription?.status !== "active") {
      setLocation("/subscribe");
    }
  }, [subscription, subscriptionLoading, setLocation]);
  
  const isCollectorRoute =
    location.startsWith("/app/workstation") ||
    location.startsWith("/app/collector/");

  const isAdminRoute =
    location === "/app" ||
    location.startsWith("/app/debtors") ||
    location.startsWith("/app/payment-runner") ||
    location.startsWith("/app/portfolios") ||
    location.startsWith("/app/collectors") ||
    location.startsWith("/app/liquidation") ||
    location.startsWith("/app/settings") ||
    location.startsWith("/app/admin/");

  useEffect(() => {
    if (isCollectorRole && isAdminRoute && !isCollectorRoute) {
      setLocation("/app/workstation");
    }
  }, [isCollectorRole, isAdminRoute, isCollectorRoute, setLocation]);

  const handleAccountSelect = (debtor: Debtor) => {
    if (isCollectorRoute || isCollectorRole) {
      setLocation(`/app/workstation?account=${debtor.id}`);
    } else {
      setLocation(`/app/debtors/${debtor.id}`);
    }
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const showCollectorSidebar = isCollectorRole || isCollectorRoute;

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {showCollectorSidebar ? (
          <CollectorSidebar
            currentCollector={currentCollector ? {
              name: currentCollector.name,
              role: currentCollector.role,
              avatarInitials: currentCollector.avatarInitials,
            } : null}
          />
        ) : (
          <AdminSidebar
            currentUser={currentCollector ? {
              name: currentCollector.name,
              role: currentCollector.role,
              initials: currentCollector.avatarInitials || "AD",
            } : null}
          />
        )}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-12 items-center justify-between gap-4 px-4 shrink-0 bg-green-600 dark:bg-green-700 text-white dark:text-white">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white dark:text-white" />
              <AccountSearch onSelect={handleAccountSelect} />
            </div>
            <div className="flex items-center gap-4">
              {authUser && (
                <span className="text-sm font-medium" data-testid="text-logged-in-user">
                  {authUser.name}
                </span>
              )}
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <AppRouter />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  const isPublicOnlyRoute = 
    location === "/" || 
    location === "/login" || 
    location === "/signup" ||
    location === "/demo" ||
    location === "/contact";
    
  const isPublicRoute = 
    isPublicOnlyRoute ||
    location === "/subscribe" ||
    location === "/super-admin-login" ||
    location === "/super-admin";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect authenticated users from public pages to dashboard
  if (isAuthenticated && isPublicOnlyRoute) {
    return <Redirect to="/app" />;
  }

  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/subscribe" component={Subscribe} />
        <Route path="/demo" component={Landing} />
        <Route path="/contact" component={Landing} />
        <Route path="/super-admin-login" component={SuperAdminLogin} />
        <Route path="/super-admin" component={SuperAdmin} />
      </Switch>
    );
  }

  // Require authentication for /app routes
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <AppLayout />;
}

function App() {
  // Capture PWA install prompt globally
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="debtflow-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrganizationProvider>
            <TooltipProvider>
              <AppContent />
              <Toaster />
            </TooltipProvider>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
