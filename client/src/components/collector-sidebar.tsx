import { useLocation, Link } from "wouter";
import {
  Headphones,
  Building2,
  ClipboardList,
  XCircle,
  TrendingUp,
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

const collectorNavItems = [
  { title: "Work Queue", url: "/workstation", icon: Headphones },
  { title: "Today's Whiteboard", url: "/collector/whiteboard", icon: ClipboardList },
  { title: "My Declines", url: "/collector/declines", icon: XCircle },
  { title: "My Liq Rates", url: "/collector/liq-rates", icon: TrendingUp },
];

interface CollectorSidebarProps {
  currentCollector?: { name: string; role: string; avatarInitials: string | null } | null;
}

export function CollectorSidebar({ currentCollector }: CollectorSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/workstation" className="flex items-center gap-2">
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
      </SidebarFooter>
    </Sidebar>
  );
}
