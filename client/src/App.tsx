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
      <Route path="/admin/tools/drop" component={DropAccounts} />
      <Route path="/admin/tools/import-export" component={ImportExport} />
      <Route path="/admin/tools/recall" component={Recall} />
      <Route path="/admin/tools/banko" component={Banko} />
      <Route path="/admin/tools/consolidation" component={Consolidation} />
      <Route path="/admin/payments/merchants" component={Merchants} />
      <Route path="/admin/payments/remittance" component={Remittance} />
      <Route path="/admin/payments/import-batch" component={ImportBatch} />
      <Route path="/admin/email/manage" component={EmailManage} />
      <Route path="/admin/email/settings" component={EmailSettings} />
      <Route path="/admin/email/templates" component={EmailTemplates} />
      <Route path="/admin/reporting/dashboard" component={CompanyDashboard} />
      <Route path="/admin/reporting/collectors" component={CollectorReporting} />
      <Route path="/admin/reporting/time-clock" component={TimeClock} />
      <Route path="/admin/settings/fees" component={FeeSchedules} />
      <Route path="/admin/settings/server-access" component={ServerAccess} />
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
