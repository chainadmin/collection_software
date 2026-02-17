import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Building2, Power, PowerOff, Search, LogOut, RefreshCw, Plus, Bell, CheckCheck, Clock, Mail, Send, Eye, EyeOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Organization, AdminNotification } from "@shared/schema";

const PLAN_SEATS = {
  starter: 4,
  growth: 15,
  agency: 40,
};

const PLAN_PRICES: Record<string, number> = {
  starter: 99,
  growth: 249,
  agency: 499,
};

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [admin, setAdmin] = useState<{ id: string; name: string; email: string; username?: string } | null>(null);
  const [sessionValid, setSessionValid] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    plan: "starter",
    firstMonthFree: false,
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  useEffect(() => {
    const validateSession = async () => {
      const stored = localStorage.getItem("superAdminSession");
      if (!stored) {
        setLocation("/super-admin-login");
        return;
      }

      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (!res.ok) {
          localStorage.removeItem("superAdminSession");
          setLocation("/super-admin-login");
          return;
        }
        const data = await res.json();

        if (data.type === "globalAdmin" && data.admin) {
          const parsed = JSON.parse(stored);
          setAdmin(parsed);
          setSessionValid(true);
        } else {
          localStorage.removeItem("superAdminSession");
          setLocation("/super-admin-login");
        }
      } catch {
        localStorage.removeItem("superAdminSession");
        setLocation("/super-admin-login");
      }
    };

    validateSession();
  }, [setLocation]);

  const handleSessionExpired = () => {
    localStorage.removeItem("superAdminSession");
    setSessionValid(false);
    setAdmin(null);
    setLocation("/super-admin-login");
  };

  const { data: organizations = [], isLoading, isError: orgsError, error: orgsErrorDetail, refetch } = useQuery<Organization[]>({
    queryKey: ["/api/super-admin/organizations"],
    enabled: sessionValid,
    retry: 1,
    staleTime: 0,
  });

  const { data: notifications = [], refetch: refetchNotifications } = useQuery<AdminNotification[]>({
    queryKey: ["/api/super-admin/notifications"],
    enabled: sessionValid,
    refetchInterval: 30000,
    retry: 1,
    staleTime: 0,
  });

  useEffect(() => {
    const interceptor = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes("401")) {
        handleSessionExpired();
      }
    };
    window.addEventListener("unhandledrejection", interceptor);
    return () => window.removeEventListener("unhandledrejection", interceptor);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/super-admin/organizations/${id}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      toast({ title: "Status Updated", description: "Organization status has been toggled." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle organization status.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newOrg) => {
      const res = await apiRequest("POST", "/api/super-admin/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/notifications"] });
      toast({ title: "Organization Created", description: "New organization has been created successfully." });
      setCreateDialogOpen(false);
      setNewOrg({
        name: "",
        slug: "",
        email: "",
        phone: "",
        plan: "starter",
        firstMonthFree: false,
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create organization.", variant: "destructive" });
    },
  });

  const freeMonthMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/super-admin/organizations/${id}/grant-free-month`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      toast({ title: "Free Month Applied", description: "Billing has been extended and the company remains connected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply free month.", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/super-admin/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/super-admin/notifications/mark-all-read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/notifications"] });
      toast({ title: "All Caught Up", description: "All notifications marked as read." });
    },
  });

  const [emailForm, setEmailForm] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: false,
    fromEmail: "",
    fromName: "Debt Manager Pro",
    notificationEmail: "support@chainsoftwaregroup.com",
    isActive: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  const { data: emailSettingsData, isLoading: emailSettingsLoading } = useQuery<{
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpSecure: boolean | null;
    fromEmail: string | null;
    fromName: string | null;
    notificationEmail: string | null;
    isActive: boolean | null;
    hasPassword: boolean;
  } | null>({
    queryKey: ["/api/super-admin/email-settings"],
    enabled: sessionValid,
    retry: false,
  });

  useEffect(() => {
    if (emailSettingsData) {
      setEmailForm({
        smtpHost: emailSettingsData.smtpHost || "",
        smtpPort: String(emailSettingsData.smtpPort || 587),
        smtpUser: emailSettingsData.smtpUser || "",
        smtpPassword: "",
        smtpSecure: emailSettingsData.smtpSecure ?? false,
        fromEmail: emailSettingsData.fromEmail || "",
        fromName: emailSettingsData.fromName || "Debt Manager Pro",
        notificationEmail: emailSettingsData.notificationEmail || "support@chainsoftwaregroup.com",
        isActive: emailSettingsData.isActive ?? false,
      });
    }
  }, [emailSettingsData]);

  const saveEmailMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      const res = await apiRequest("POST", "/api/super-admin/email-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/email-settings"] });
      toast({ title: "Saved", description: "Email settings saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save email settings.", variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/super-admin/email-settings/test");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Test Email Sent", description: "Check your inbox for the test notification." });
      } else {
        toast({ title: "Test Failed", description: data.error || "Failed to send test email.", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send test email.", variant: "destructive" });
    },
  });

  const handleCreateOrg = () => {
    if (!newOrg.name || !newOrg.slug || !newOrg.adminName || !newOrg.adminEmail || !newOrg.adminPassword) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate(newOrg);
  };

  const handleLogout = () => {
    localStorage.removeItem("superAdminSession");
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setLocation("/super-admin-login");
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = organizations.filter((o) => o.isActive).length;
  const inactiveCount = organizations.filter((o) => !o.isActive).length;

  const getMonthlyPaymentLabel = (org: Organization) => {
    const amount = PLAN_PRICES[org.subscriptionPlan || "starter"] ?? PLAN_PRICES.starter;
    const billingStart = org.billingStartDate ? new Date(org.billingStartDate) : null;
    const today = new Date();

    if (org.firstMonthFree && billingStart && billingStart > today) {
      return "$0 (Free month)";
    }

    return `$${amount}/mo`;
  };

  if (!admin || !sessionValid) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Super Admin Portal</h1>
              <p className="text-sm text-muted-foreground">Debt Manager Pro</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{admin.username || admin.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-orgs">{organizations.length}</p>
                  <p className="text-sm text-muted-foreground">Total Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10 dark:bg-green-500/20">
                  <Power className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 dark:bg-red-500/20">
                  <PowerOff className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10 dark:bg-yellow-500/20">
                  <Bell className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-unread-count">{unreadCount}</p>
                  <p className="text-sm text-muted-foreground">Unread Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organizations" data-testid="tab-organizations">
              <Building2 className="h-4 w-4 mr-2" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications" className="relative">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 no-default-hover-elevate no-default-active-elevate">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email-settings" data-testid="tab-email-settings">
              <Mail className="h-4 w-4 mr-2" />
              Email Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Organizations</CardTitle>
                    <CardDescription>Manage all registered organizations</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-create-org">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Organization
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create New Organization</DialogTitle>
                          <DialogDescription>
                            Add a new collection agency to the platform
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="org-name">Company Name *</Label>
                            <Input
                              id="org-name"
                              placeholder="Acme Collections"
                              value={newOrg.name}
                              onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })}
                              data-testid="input-org-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-slug">URL Slug *</Label>
                            <Input
                              id="org-slug"
                              placeholder="acme-collections"
                              value={newOrg.slug}
                              onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value })}
                              data-testid="input-org-slug"
                            />
                            <p className="text-xs text-muted-foreground">Used for login URL: /login/{newOrg.slug || 'your-slug'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="org-email">Email</Label>
                              <Input
                                id="org-email"
                                type="email"
                                placeholder="contact@company.com"
                                value={newOrg.email}
                                onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })}
                                data-testid="input-org-email"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="org-phone">Phone</Label>
                              <Input
                                id="org-phone"
                                placeholder="(555) 123-4567"
                                value={newOrg.phone}
                                onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
                                data-testid="input-org-phone"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="org-plan">Subscription Plan</Label>
                            <Select value={newOrg.plan} onValueChange={(val) => setNewOrg({ ...newOrg, plan: val })}>
                              <SelectTrigger data-testid="select-plan">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="starter">Starter - $200/mo (4 seats)</SelectItem>
                                <SelectItem value="growth">Growth - $400/mo (15 seats)</SelectItem>
                                <SelectItem value="agency">Agency - $750/mo (40 seats)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="first-month-free"
                              checked={newOrg.firstMonthFree}
                              onCheckedChange={(checked) => setNewOrg({ ...newOrg, firstMonthFree: !!checked })}
                              data-testid="checkbox-first-month-free"
                            />
                            <Label htmlFor="first-month-free" className="text-sm font-normal">
                              First month free
                            </Label>
                          </div>
                          <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium mb-3">Admin Account</p>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="admin-name">Admin Name *</Label>
                                <Input
                                  id="admin-name"
                                  placeholder="John Smith"
                                  value={newOrg.adminName}
                                  onChange={(e) => setNewOrg({ ...newOrg, adminName: e.target.value })}
                                  data-testid="input-admin-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="admin-email">Admin Email (Username) *</Label>
                                <Input
                                  id="admin-email"
                                  type="email"
                                  placeholder="admin@company.com"
                                  value={newOrg.adminEmail}
                                  onChange={(e) => setNewOrg({ ...newOrg, adminEmail: e.target.value })}
                                  data-testid="input-admin-email"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="admin-password">Admin Password *</Label>
                                <Input
                                  id="admin-password"
                                  type="password"
                                  placeholder="Enter password"
                                  value={newOrg.adminPassword}
                                  onChange={(e) => setNewOrg({ ...newOrg, adminPassword: e.target.value })}
                                  data-testid="input-admin-password"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateOrg} disabled={createMutation.isPending} data-testid="button-submit-create-org">
                            {createMutation.isPending ? "Creating..." : "Create Organization"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                    <p>Loading organizations...</p>
                  </div>
                ) : orgsError ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-destructive" />
                    <p className="text-destructive font-medium">Failed to load organizations</p>
                    <p className="text-sm text-muted-foreground mt-1">{orgsErrorDetail?.message || "Unknown error"}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()} data-testid="button-retry-orgs">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : filteredOrgs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No organizations found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map((org) => (
                        <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-sm text-muted-foreground">{org.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                              {(org.subscriptionPlan || "starter").charAt(0).toUpperCase() + (org.subscriptionPlan || "starter").slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{getMonthlyPaymentLabel(org)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{org.email || "-"}</p>
                              <p className="text-muted-foreground">{org.phone || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{org.createdDate ? new Date(org.createdDate).toLocaleDateString() : "-"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={org.isActive ? "default" : "secondary"}>
                              {org.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleMutation.mutate(org.id)}
                              disabled={toggleMutation.isPending || freeMonthMutation.isPending}
                              data-testid={`button-toggle-${org.id}`}
                            >
                              {org.isActive ? (
                                <>
                                  <PowerOff className="h-4 w-4 mr-2" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <Power className="h-4 w-4 mr-2" />
                                  Enable
                                </>
                              )}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="ml-2"
                              onClick={() => freeMonthMutation.mutate(org.id)}
                              disabled={toggleMutation.isPending || freeMonthMutation.isPending}
                              data-testid={`button-free-month-${org.id}`}
                            >
                              Free Month
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Alerts for new signups, billing events, and system activity</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        data-testid="button-mark-all-read"
                      >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Mark All Read
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refetchNotifications()} data-testid="button-refresh-notifications">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No notifications yet</p>
                    <p className="text-sm mt-1">You'll see alerts here when new companies sign up</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-4 p-4 rounded-md border ${
                          notification.isRead
                            ? "bg-background"
                            : "bg-primary/5 border-primary/20"
                        }`}
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className={`mt-0.5 p-2 rounded-lg ${
                          notification.type === "new_org"
                            ? "bg-green-500/10 dark:bg-green-500/20"
                            : notification.type === "payment_failed"
                            ? "bg-red-500/10 dark:bg-red-500/20"
                            : "bg-blue-500/10 dark:bg-blue-500/20"
                        }`}>
                          {notification.type === "new_org" ? (
                            <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : notification.type === "payment_failed" ? (
                            <PowerOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {!notification.isRead && (
                              <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">New</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          {notification.organizationName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Organization: {notification.organizationName}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {notification.createdDate ? new Date(notification.createdDate).toLocaleString() : "-"}
                            </span>
                          </div>
                        </div>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markReadMutation.mutate(notification.id)}
                            disabled={markReadMutation.isPending}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email-settings">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle data-testid="text-email-settings-title">Email Notification Settings</CardTitle>
                    <CardDescription>Configure SMTP settings to send email notifications when new companies register.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="email-active">Email Notifications Active</Label>
                    <Switch
                      id="email-active"
                      data-testid="switch-email-active"
                      checked={emailForm.isActive}
                      onCheckedChange={(checked) => setEmailForm({ ...emailForm, isActive: checked })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {emailSettingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading email settings...</span>
                  </div>
                ) : (
                <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      data-testid="input-smtp-host"
                      placeholder="smtp.office365.com"
                      value={emailForm.smtpHost}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <Input
                      id="smtp-port"
                      data-testid="input-smtp-port"
                      placeholder="587"
                      value={emailForm.smtpPort}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpPort: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">SMTP Username / Email</Label>
                    <Input
                      id="smtp-user"
                      data-testid="input-smtp-user"
                      placeholder="notifications@yourdomain.com"
                      value={emailForm.smtpUser}
                      onChange={(e) => setEmailForm({ ...emailForm, smtpUser: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-password">SMTP Password</Label>
                    <div className="relative">
                      <Input
                        id="smtp-password"
                        data-testid="input-smtp-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={emailSettingsData?.hasPassword ? "Leave blank to keep existing" : "Enter password"}
                        value={emailForm.smtpPassword}
                        onChange={(e) => setEmailForm({ ...emailForm, smtpPassword: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="smtp-secure"
                    data-testid="checkbox-smtp-secure"
                    checked={emailForm.smtpSecure}
                    onCheckedChange={(checked) => setEmailForm({ ...emailForm, smtpSecure: !!checked })}
                  />
                  <Label htmlFor="smtp-secure">Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).</Label>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Sender Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="from-email">From Email Address</Label>
                      <Input
                        id="from-email"
                        data-testid="input-from-email"
                        placeholder="notifications@yourdomain.com"
                        value={emailForm.fromEmail}
                        onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="from-name">From Display Name</Label>
                      <Input
                        id="from-name"
                        data-testid="input-from-name"
                        placeholder="Debt Manager Pro"
                        value={emailForm.fromName}
                        onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Notification Recipient</h4>
                  <div className="space-y-2">
                    <Label htmlFor="notification-email">Send Notifications To</Label>
                    <Input
                      id="notification-email"
                      data-testid="input-notification-email"
                      placeholder="support@chainsoftwaregroup.com"
                      value={emailForm.notificationEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, notificationEmail: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Email address that will receive new company registration notifications.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <Button
                    data-testid="button-save-email-settings"
                    onClick={() => saveEmailMutation.mutate(emailForm)}
                    disabled={saveEmailMutation.isPending}
                  >
                    {saveEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Save Settings
                  </Button>
                  <Button
                    variant="outline"
                    data-testid="button-test-email"
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending || !emailForm.isActive}
                  >
                    {testEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Test Email
                  </Button>
                </div>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
