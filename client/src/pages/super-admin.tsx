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
import { ShieldCheck, Building2, Users, Power, PowerOff, Search, LogOut, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Organization } from "@shared/schema";

const PLAN_SEATS = {
  starter: 4,
  growth: 15,
  agency: 40,
};

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [admin, setAdmin] = useState<{ id: string; name: string; email: string } | null>(null);
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
    const session = localStorage.getItem("superAdminSession");
    if (!session) {
      setLocation("/super-admin-login");
      return;
    }
    try {
      setAdmin(JSON.parse(session));
    } catch {
      localStorage.removeItem("superAdminSession");
      setLocation("/super-admin-login");
    }
  }, [setLocation]);

  const { data: organizations = [], isLoading, refetch } = useQuery<Organization[]>({
    queryKey: ["/api/super-admin/organizations"],
    enabled: !!admin,
  });

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

  const handleCreateOrg = () => {
    if (!newOrg.name || !newOrg.slug || !newOrg.adminName || !newOrg.adminEmail || !newOrg.adminPassword) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate(newOrg);
  };

  const handleLogout = () => {
    localStorage.removeItem("superAdminSession");
    setLocation("/super-admin-login");
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = organizations.filter((o) => o.isActive).length;
  const inactiveCount = organizations.filter((o) => !o.isActive).length;

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
            <span className="text-sm text-muted-foreground">{admin.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{organizations.length}</p>
                  <p className="text-sm text-muted-foreground">Total Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Power className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Active Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <PowerOff className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                  <p className="text-sm text-muted-foreground">Inactive Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <div className="text-center py-8 text-muted-foreground">Loading organizations...</div>
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
                        <div className="text-sm">
                          <p>{org.email || "-"}</p>
                          <p className="text-muted-foreground">{org.phone || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{org.createdDate}</span>
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
                          disabled={toggleMutation.isPending}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
