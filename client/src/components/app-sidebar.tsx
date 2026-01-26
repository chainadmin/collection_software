import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  Wallet,
  FolderKanban,
  CreditCard,
  TrendingUp,
  Settings,
  Building2,
  Headphones,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
  },
  {
    title: "Workstation",
    url: "/app/workstation",
    icon: Headphones,
  },
  {
    title: "Debtors",
    url: "/app/debtors",
    icon: Users,
  },
  {
    title: "Payment Runner",
    url: "/app/payment-runner",
    icon: CreditCard,
  },
  {
    title: "Portfolios",
    url: "/app/portfolios",
    icon: FolderKanban,
  },
];

const adminNavItems = [
  {
    title: "Collectors",
    url: "/app/collectors",
    icon: Wallet,
  },
  {
    title: "Liquidation",
    url: "/app/liquidation",
    icon: TrendingUp,
  },
  {
    title: "Settings",
    url: "/app/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

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
            Main Menu
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
              {adminNavItems.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">John Doe</span>
            <span className="text-xs text-muted-foreground">Administrator</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
