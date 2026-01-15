import { Switch, Route, useLocation } from "wouter";
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
import NotFound from "@/pages/not-found";
import type { Collector, Debtor } from "@shared/schema";

function Router() {
  const [, setLocation] = useLocation();
  
  const handleAccountSelect = (debtor: Debtor) => {
    setLocation(`/debtors/${debtor.id}`);
  };
  
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/workstation" component={Workstation} />
      <Route path="/debtors" component={Debtors} />
      <Route path="/debtors/:id" component={DebtorDetail} />
      <Route path="/payment-runner" component={PaymentRunner} />
      <Route path="/portfolios" component={Portfolios} />
      <Route path="/collectors" component={Collectors} />
      <Route path="/liquidation" component={Liquidation} />
      <Route path="/settings" component={Settings} />
      <Route path="/collector/whiteboard" component={Whiteboard} />
      <Route path="/collector/declines" component={Declines} />
      <Route path="/collector/liq-rates" component={LiqRates} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();
  
  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const currentCollector = collectors[1];
  
  const isCollectorRoute =
    location.startsWith("/workstation") ||
    location.startsWith("/collector/");

  const handleAccountSelect = (debtor: Debtor) => {
    if (isCollectorRoute) {
      setLocation(`/workstation?account=${debtor.id}`);
    } else {
      setLocation(`/debtors/${debtor.id}`);
    }
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {isCollectorRoute ? (
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
          <header className="flex h-12 items-center justify-between gap-4 border-b px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <AccountSearch onSelect={handleAccountSelect} />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="collectmax-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
