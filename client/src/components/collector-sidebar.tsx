import { useLocation, Link } from "wouter";
import {
  Headphones,
  Building2,
  ClipboardList,
  XCircle,
  TrendingUp,
  LogOut,
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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

function LogoutButton() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
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

const collectorNavItems = [
  { title: "Work Queue", url: "/app/workstation", icon: Headphones },
  { title: "Today's Whiteboard", url: "/app/collector/whiteboard", icon: ClipboardList },
  { title: "My Declines", url: "/app/collector/declines", icon: XCircle },
  { title: "My Liq Rates", url: "/app/collector/liq-rates", icon: TrendingUp },
];

interface CollectorSidebarProps {
  currentCollector?: { name: string; role: string; avatarInitials: string | null } | null;
}

export function CollectorSidebar({ currentCollector }: CollectorSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/app/workstation" className="flex items-center gap-2">
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
            My Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {collectorNavItems.map((item) => (
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {currentCollector?.avatarInitials || "CO"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">
                {currentCollector?.name || "Collector"}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentCollector?.role || "Collector"}
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
