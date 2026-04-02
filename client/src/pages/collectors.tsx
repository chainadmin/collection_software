import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Target,
  DollarSign,
  User,
  Edit,
  Trash2,
  LayoutDashboard,
  Mail,
  CreditCard,
  Link2,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, getInitials } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collector } from "@shared/schema";

const addCollectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().default("collector"),
  status: z.string().default("active"),
  goal: z.number().min(0).default(0),
  hourlyWage: z.number().min(1, "Hourly wage is required"),
  canViewDashboard: z.boolean().default(false),
  canViewEmail: z.boolean().default(false),
  canViewPaymentRunner: z.boolean().default(false),
});

const editCollectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.string().default("collector"),
  status: z.string().default("active"),
  goal: z.number().min(0).default(0),
  hourlyWage: z.number().min(1, "Hourly wage is required"),
  canViewDashboard: z.boolean().default(false),
  canViewEmail: z.boolean().default(false),
  canViewPaymentRunner: z.boolean().default(false),
});

type AddCollectorForm = z.infer<typeof addCollectorSchema>;
type EditCollectorForm = z.infer<typeof editCollectorSchema>;

export default function Collectors() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);

  const { data: collectors, isLoading } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const addForm = useForm<AddCollectorForm>({
    resolver: zodResolver(addCollectorSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "collector",
      status: "active",
      goal: 0,
      hourlyWage: 0,
      canViewDashboard: false,
      canViewEmail: false,
      canViewPaymentRunner: false,
    },
  });

  const editForm = useForm<EditCollectorForm>({
    resolver: zodResolver(editCollectorSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "collector",
      status: "active",
      goal: 0,
      hourlyWage: 0,
      canViewDashboard: false,
      canViewEmail: false,
      canViewPaymentRunner: false,
    },
  });

  const openEditDialog = (collector: Collector) => {
    setEditingCollector(collector);
    editForm.reset({
      name: collector.name,
      email: collector.email || "",
      username: collector.username,
      password: "",
      role: collector.role,
      status: collector.status,
      goal: collector.goal || 0,
      hourlyWage: collector.hourlyWage || 0,
      canViewDashboard: collector.canViewDashboard ?? false,
      canViewEmail: collector.canViewEmail ?? false,
      canViewPaymentRunner: collector.canViewPaymentRunner ?? false,
    });
  };

  const addCollectorMutation = useMutation({
    mutationFn: async (data: AddCollectorForm) => {
      return apiRequest("POST", "/api/collectors", {
        ...data,
        avatarInitials: getInitials(data.name),
        goal: data.goal,
        hourlyWage: data.hourlyWage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      setShowAddDialog(false);
      addForm.reset();
      toast({ title: "Collector added", description: "Collector has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add collector.", variant: "destructive" });
    },
  });

  const editCollectorMutation = useMutation({
    mutationFn: async (data: EditCollectorForm) => {
      if (!editingCollector) return;
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email || "",
        username: data.username,
        role: data.role,
        status: data.status,
        goal: data.goal,
        hourlyWage: data.hourlyWage,
        canViewDashboard: data.canViewDashboard,
        canViewEmail: data.canViewEmail,
        canViewPaymentRunner: data.canViewPaymentRunner,
        avatarInitials: getInitials(data.name),
      };
      if (data.password && data.password.length >= 6) {
        payload.password = data.password;
      }
      return apiRequest("PATCH", `/api/collectors/${editingCollector.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      setEditingCollector(null);
      toast({ title: "Collector updated", description: "Collector info has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update collector.", variant: "destructive" });
    },
  });

  const deleteCollectorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/collectors/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      toast({ title: "Collector removed", description: "Collector has been removed." });
    },
  });

  const filteredCollectors = collectors?.filter((collector) => {
    return (
      searchQuery === "" ||
      collector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collector.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collector.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const activeCollectors = collectors?.filter((c) => c.status === "active").length || 0;
  const totalSeats = collectors?.length || 0;
  const totalGoal = collectors?.reduce((sum, c) => sum + (c.goal || 0), 0) || 0;

  const collectorLoginUrl = typeof window !== "undefined"
    ? `${window.location.origin}/collector-login`
    : "/collector-login";

  const CollectorFormFields = ({ formInstance, isEdit }: { formInstance: any; isEdit?: boolean }) => (
    <>
      <FormField
        control={formInstance.control}
        name="name"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <Input placeholder="John Smith" {...field} data-testid="input-collector-name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
        name="hourlyWage"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Hourly Wage ($)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="15.00"
                step="0.01"
                {...field}
                value={field.value ? (field.value / 100).toFixed(2) : ""}
                onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                data-testid="input-collector-hourly-wage"
              />
            </FormControl>
            <FormDescription>Required - used for profitability tracking</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={formInstance.control}
        name="email"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Email Address (Optional)</FormLabel>
            <FormControl>
              <Input type="email" placeholder="john@company.com" {...field} data-testid="input-collector-email" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="username"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="jsmith" {...field} data-testid="input-collector-username" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="password"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>{isEdit ? "New Password" : "Password"}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={isEdit ? "Leave blank to keep current" : "••••••••"}
                  {...field}
                  data-testid="input-collector-password"
                />
              </FormControl>
              {isEdit && <FormDescription>Leave blank to keep existing password</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="role"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-collector-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="collector">Collector</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formInstance.control}
          name="status"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-collector-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={formInstance.control}
        name="goal"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Monthly Goal ($)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="25000"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value || "0"))}
                data-testid="input-collector-goal"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="space-y-3 pt-2">
        <FormLabel className="text-sm font-medium">Workstation Permissions</FormLabel>
        <div className="space-y-2">
          <FormField
            control={formInstance.control}
            name="canViewDashboard"
            render={({ field }: any) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-dashboard" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Company Dashboard</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={formInstance.control}
            name="canViewEmail"
            render={({ field }: any) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-email" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Email / SMS Tab</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={formInstance.control}
            name="canViewPaymentRunner"
            render={({ field }: any) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-payment-runner" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Payment Runner</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Collectors</h1>
          <p className="text-sm text-muted-foreground">
            Manage collectors and their assignments
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-collector">
          <Plus className="h-4 w-4 mr-2" />
          Add Collector
        </Button>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Collector Login URL</p>
          <code className="text-xs truncate block" data-testid="text-collector-login-url">{collectorLoginUrl}</code>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(collectorLoginUrl);
            toast({ title: "Copied!", description: "Collector login URL copied to clipboard." });
          }}
          data-testid="button-copy-collector-login-url"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Active Collectors"
          value={activeCollectors.toString()}
          subtitle={`of ${totalSeats} total`}
          icon={Users}
        />
        <StatCard
          title="Total Collectors"
          value={totalSeats.toString()}
          icon={Users}
        />
        <StatCard
          title="Combined Goal"
          value={formatCurrency(totalGoal)}
          subtitle="monthly target"
          icon={Target}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search collectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-collectors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : filteredCollectors && filteredCollectors.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCollectors.map((collector) => (
                <Card
                  key={collector.id}
                  className="hover-elevate"
                  data-testid={`collector-card-${collector.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {collector.avatarInitials || getInitials(collector.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{collector.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{collector.role}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`collector-menu-${collector.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(collector)} data-testid={`button-edit-collector-${collector.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteCollectorMutation.mutate(collector.id)}
                            data-testid={`button-delete-collector-${collector.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>@{collector.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-mono">{formatCurrency((collector.hourlyWage || 0))}/hr</span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <StatusBadge status={collector.status} />
                        <div className="flex items-center gap-1 text-sm">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{formatCurrency(collector.goal || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No collectors found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Get started by adding your first collector"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collector
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Collector Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) addForm.reset(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Collector</DialogTitle>
            <DialogDescription>
              Add a new collector to your organization.
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addCollectorMutation.mutate(data))} className="space-y-4">
              <CollectorFormFields formInstance={addForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addCollectorMutation.isPending} data-testid="button-submit-collector">
                  {addCollectorMutation.isPending ? "Adding..." : "Add Collector"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Collector Dialog */}
      <Dialog open={!!editingCollector} onOpenChange={(open) => { if (!open) setEditingCollector(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Collector</DialogTitle>
            <DialogDescription>
              Update {editingCollector?.name}'s information and permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editCollectorMutation.mutate(data))} className="space-y-4">
              <CollectorFormFields formInstance={editForm} isEdit />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCollector(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editCollectorMutation.isPending} data-testid="button-submit-edit-collector">
                  {editCollectorMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
