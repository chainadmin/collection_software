import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CreditCard,
  TrendingUp,
  Settings,
  Building2,
  Wrench,
  Mail,
  BarChart3,
  ChevronDown,
  FileDown,
  FileUp,
  AlertTriangle,
  Scale,
  Layers,
  Banknote,
  Receipt,
  Upload,
  Inbox,
  FileText,
  Clock,
  UserCog,
  DollarSign,
  Server,
  Headphones,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

function LogoutButton() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      title="Sign out"
      data-testid="button-logout"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
}

const adminSections: NavSection[] = [
  {
    title: "Tools",
    icon: Wrench,
    items: [
      { title: "Drop Accounts", url: "/app/admin/tools/drop", icon: FileDown },
      { title: "Import/Export", url: "/app/admin/tools/import-export", icon: FileUp },
      { title: "Recall", url: "/app/admin/tools/recall", icon: AlertTriangle },
      { title: "Banko", url: "/app/admin/tools/banko", icon: Scale },
      { title: "Consolidation", url: "/app/admin/tools/consolidation", icon: Layers },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: [
      { title: "Payment Runner", url: "/app/payment-runner", icon: CreditCard },
      { title: "Merchants", url: "/app/admin/payments/merchants", icon: Banknote },
      { title: "Remittance", url: "/app/admin/payments/remittance", icon: Receipt },
      { title: "Import Batch", url: "/app/admin/payments/import-batch", icon: Upload },
    ],
  },
  {
    title: "SMS/TXT",
    icon: Mail,
    items: [
      { title: "Manage", url: "/app/admin/email/manage", icon: Inbox },
      { title: "Settings", url: "/app/admin/email/settings", icon: Settings },
      { title: "Templates", url: "/app/admin/email/templates", icon: FileText },
    ],
  },
  {
    title: "Reporting",
    icon: BarChart3,
    items: [
      { title: "Company Dashboard", url: "/app/admin/reporting/dashboard", icon: LayoutDashboard },
      { title: "Collector Reporting", url: "/app/admin/reporting/collectors", icon: Users },
      { title: "Time Clock", url: "/app/admin/reporting/time-clock", icon: Clock },
      { title: "Liquidation Rates", url: "/app/liquidation", icon: TrendingUp },
    ],
  },
  {
    title: "Global Settings",
    icon: Settings,
    items: [
      { title: "Collector Options", url: "/app/collectors", icon: UserCog },
      { title: "Fee Schedule", url: "/app/admin/settings/fees", icon: DollarSign },
      { title: "Server Access", url: "/app/admin/settings/server-access", icon: Server },
    ],
  },
];

const mainNavItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Workstation", url: "/app/workstation", icon: Headphones },
  { title: "Clients", url: "/app/admin/clients", icon: Building2 },
  { title: "Debtors", url: "/app/debtors", icon: Users },
  { title: "Portfolios", url: "/app/portfolios", icon: FolderKanban },
];

interface AdminSidebarProps {
  currentUser?: { name: string; role: string; initials: string } | null;
}

export function AdminSidebar({ currentUser }: AdminSidebarProps) {
  const [location] = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isSectionActive = (section: NavSection) => {
    return section.items.some((item) => location === item.url || location.startsWith(item.url));
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/app" className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="Debt Manager Pro" 
            className="h-9 w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminSections.map((section) => (
                <Collapsible
                  key={section.title}
                  open={openSections[section.title] || isSectionActive(section)}
                  onOpenChange={() => toggleSection(section.title)}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        data-testid={`nav-section-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <section.icon className="h-4 w-4" />
                        <span>{section.title}</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === item.url}
                              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-3 w-3" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {currentUser?.initials || "AD"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">
                {currentUser?.name || "Administrator"}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentUser?.role || "Admin"}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
