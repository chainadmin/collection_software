import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useWatch } from "react-hook-form";
import type { Control, FieldValues } from "react-hook-form";
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
  QrCode,
  Download,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/lib/auth-context";
import type { Collector, Client } from "@shared/schema";

// An auditor doesn't collect payments and isn't tracked for profitability,
// so unlike every other role they don't need an hourly wage on file.
function requireHourlyWageUnlessAuditor(data: { role?: string; hourlyWage: number }, ctx: z.RefinementCtx) {
  if (data.role !== "auditor" && (!data.hourlyWage || data.hourlyWage < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hourly wage is required", path: ["hourlyWage"] });
  }
}

const addCollectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().default("collector"),
  status: z.string().default("active"),
  goal: z.number().min(0).default(0),
  hourlyWage: z.number().min(0).default(0),
  canViewDashboard: z.boolean().default(false),
  canViewEmail: z.boolean().default(false),
  canViewPaymentRunner: z.boolean().default(false),
  canEditPayments: z.boolean().default(false),
  canViewFinancials: z.boolean().default(false),
  extension: z.string().optional().or(z.literal("")),
  chiamoEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  // Locks an auditor to one client's portfolios/debtors/remittance/
  // liquidation data. "" means unrestricted (sees the whole org). Ignored
  // for every other role.
  assignedClientId: z.string().optional().or(z.literal("")),
}).superRefine(requireHourlyWageUnlessAuditor);

const editCollectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.string().default("collector"),
  status: z.string().default("active"),
  goal: z.number().min(0).default(0),
  hourlyWage: z.number().min(0).default(0),
  canViewDashboard: z.boolean().default(false),
  canViewEmail: z.boolean().default(false),
  canViewPaymentRunner: z.boolean().default(false),
  canEditPayments: z.boolean().default(false),
  canViewFinancials: z.boolean().default(false),
  extension: z.string().optional().or(z.literal("")),
  chiamoEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  assignedClientId: z.string().optional().or(z.literal("")),
}).superRefine(requireHourlyWageUnlessAuditor);

type AddCollectorForm = z.infer<typeof addCollectorSchema>;
type EditCollectorForm = z.infer<typeof editCollectorSchema>;

interface CollectorFormFieldsProps {
  control: Control<FieldValues>;
  isEdit?: boolean;
  showFinancials: boolean;
}

function CollectorFormFields({ control, isEdit, showFinancials }: CollectorFormFieldsProps) {
  const role = useWatch({ control, name: "role" });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <Input placeholder="John Smith" {...field} data-testid="input-collector-name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showFinancials && role !== "auditor" && (
        <FormField
          control={control}
          name="hourlyWage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hourly Wage ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="15.00"
                  step="0.01"
                  value={field.value ? (field.value / 100).toFixed(2) : ""}
                  onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  data-testid="input-collector-hourly-wage"
                />
              </FormControl>
              <FormDescription>Required — used for profitability tracking</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="email"
        render={({ field }) => (
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
          control={control}
          name="username"
          render={({ field }) => (
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
          control={control}
          name="password"
          render={({ field }) => (
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
          control={control}
          name="role"
          render={({ field }) => (
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
                  <SelectItem value="auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
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
      {role === "auditor" && (
        <FormField
          control={control}
          name="assignedClientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client (optional)</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"}>
                <FormControl>
                  <SelectTrigger data-testid="select-collector-assigned-client">
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No restriction (sees the whole org)</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Locks this auditor to only that client's portfolios, debtors, remittance, and liquidation data.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="goal"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Monthly Goal ($)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="25000"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(parseInt(e.target.value || "0"))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                data-testid="input-collector-goal"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {role !== "auditor" && (
      <div className="space-y-3 pt-2">
        <FormLabel className="text-sm font-medium">Workstation Permissions</FormLabel>
        <div className="space-y-2">
          <FormField
            control={control}
            name="canViewDashboard"
            render={({ field }) => (
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
            control={control}
            name="canViewEmail"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-email" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Send Email / Text Messages</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="canViewPaymentRunner"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-payment-runner" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Run Scheduled Payments</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="canEditPayments"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-edit-payments" />
                </FormControl>
                <div className="flex items-center gap-2 pb-0">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                  <FormLabel className="font-normal">Edit Pending Payments</FormLabel>
                </div>
              </FormItem>
            )}
          />
          {showFinancials && (
            <FormField
              control={control}
              name="canViewFinancials"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-view-financials" />
                  </FormControl>
                  <div className="flex items-center gap-2 pb-0">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <FormLabel className="font-normal">Company Financials &amp; Wages</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
      )}
      <div className="space-y-3 pt-2">
        <FormLabel className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Phone Integration (Chiamo)
        </FormLabel>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="extension"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extension</FormLabel>
                <FormControl>
                  <Input placeholder="101" {...field} data-testid="input-collector-extension" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="chiamoEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chiamo Login Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jsmith@company.com" {...field} data-testid="input-collector-chiamo-email" />
                </FormControl>
                <FormDescription>The email this collector logs into Chiamo with — links an incoming call to their DMP account.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}

interface AddCollectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showFinancials: boolean;
  initialRole?: "collector" | "auditor";
}

function AddCollectorDialog({ open, onOpenChange, showFinancials, initialRole = "collector" }: AddCollectorDialogProps) {
  const { toast } = useToast();

  const form = useForm<AddCollectorForm>({
    resolver: zodResolver(addCollectorSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      role: initialRole,
      status: "active",
      goal: 0,
      // Hourly wage is required by the schema, but the field is hidden from
      // anyone without financial visibility - seed a placeholder so they can
      // still onboard a collector; someone with financial visibility can set
      // the real rate afterward.
      hourlyWage: showFinancials ? 0 : 1500,
      canViewDashboard: false,
      canViewEmail: false,
      canViewPaymentRunner: false,
      canEditPayments: false,
      canViewFinancials: false,
      extension: "",
      chiamoEmail: "",
      assignedClientId: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AddCollectorForm) => {
      return apiRequest("POST", "/api/collectors", {
        ...data,
        avatarInitials: getInitials(data.name),
        assignedClientId: data.assignedClientId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      onOpenChange(false);
      form.reset();
      toast({ title: initialRole === "auditor" ? "Auditor added" : "Collector added", description: `${initialRole === "auditor" ? "Auditor" : "Collector"} has been created successfully.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add collector.", variant: "destructive" });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {initialRole === "auditor" ? "Auditor" : "Collector"}</DialogTitle>
          <DialogDescription>Add a new {initialRole} to your organization.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <CollectorFormFields control={form.control as unknown as Control<FieldValues>} showFinancials={showFinancials} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-collector"
              >
                {mutation.isPending ? "Adding..." : "Add Collector"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface EditCollectorDialogProps {
  collector: Collector | null;
  onClose: () => void;
  showFinancials: boolean;
}

function EditCollectorDialog({ collector, onClose, showFinancials }: EditCollectorDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditCollectorForm>({
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
      canEditPayments: false,
      canViewFinancials: false,
      extension: "",
      chiamoEmail: "",
      assignedClientId: "",
    },
  });

  useEffect(() => {
    if (collector) {
      form.reset({
        name: collector.name,
        email: collector.email || "",
        username: collector.username,
        password: "",
        role: collector.role,
        status: collector.status,
        goal: collector.goal || 0,
        // The server redacts hourlyWage to null for a viewer without
        // financial visibility, so seed a placeholder rather than 0 - it
        // never reaches the server (see payload below), it just keeps the
        // hidden field's value valid for the form.
        hourlyWage: showFinancials ? (collector.hourlyWage || 0) : 1500,
        canViewDashboard: collector.canViewDashboard ?? false,
        canViewEmail: collector.canViewEmail ?? false,
        canViewPaymentRunner: collector.canViewPaymentRunner ?? false,
        canEditPayments: collector.canEditPayments ?? false,
        canViewFinancials: collector.canViewFinancials ?? false,
        extension: collector.extension || "",
        chiamoEmail: collector.chiamoEmail || "",
        assignedClientId: collector.assignedClientId || "",
      });
    }
  }, [collector?.id]);

  const mutation = useMutation({
    mutationFn: async (data: EditCollectorForm) => {
      if (!collector) return;
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email || "",
        username: data.username,
        role: data.role,
        status: data.status,
        goal: data.goal,
        canViewDashboard: data.canViewDashboard,
        canViewEmail: data.canViewEmail,
        canViewPaymentRunner: data.canViewPaymentRunner,
        canEditPayments: data.canEditPayments,
        avatarInitials: getInitials(data.name),
        extension: data.extension || null,
        chiamoEmail: data.chiamoEmail || null,
        assignedClientId: data.assignedClientId || null,
      };
      // Both fields are hidden from anyone without financial visibility, and
      // their form values are only placeholders in that case - never send
      // them, so a save from that editor can't clobber the real wage or
      // silently change who can see financials.
      if (showFinancials) {
        payload.hourlyWage = data.hourlyWage;
        payload.canViewFinancials = data.canViewFinancials;
      }
      if (data.password && data.password.length >= 6) {
        payload.password = data.password;
      }
      return apiRequest("PATCH", `/api/collectors/${collector.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      onClose();
      toast({ title: "Collector updated", description: "Collector info has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update collector.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!collector} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Collector</DialogTitle>
          <DialogDescription>
            Update {collector?.name}'s information and permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <CollectorFormFields control={form.control as unknown as Control<FieldValues>} isEdit showFinancials={showFinancials} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-edit-collector"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface RemovalImpact {
  totalAssigned: number;
  houseDeskCount: number;
  companyAccountsCount: number;
}

interface RemoveCollectorDialogProps {
  collector: Collector | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRemoving: boolean;
}

function RemoveCollectorDialog({ collector, onOpenChange, onConfirm, isRemoving }: RemoveCollectorDialogProps) {
  const { data: impact, isLoading } = useQuery<RemovalImpact>({
    queryKey: ["/api/collectors", collector?.id, "removal-impact"],
    enabled: !!collector,
  });

  return (
    <AlertDialog open={!!collector} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {collector?.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>This permanently removes the collector. This action cannot be undone.</p>
              {isLoading ? (
                <p>Checking assigned accounts…</p>
              ) : impact && impact.totalAssigned > 0 ? (
                <div className="rounded-md border bg-muted/50 p-3 space-y-1.5">
                  <p className="font-medium text-foreground">
                    {impact.totalAssigned} assigned account{impact.totalAssigned === 1 ? "" : "s"} will be affected:
                  </p>
                  {impact.houseDeskCount > 0 && (
                    <p>
                      • <strong className="text-foreground">{impact.houseDeskCount}</strong> with no payment history → House Desk (unassigned)
                    </p>
                  )}
                  {impact.companyAccountsCount > 0 && (
                    <p>
                      • <strong className="text-foreground">{impact.companyAccountsCount}</strong> with payment history → Company Accounts (so history stays tracked)
                    </p>
                  )}
                </div>
              ) : (
                <p>This collector has no assigned accounts.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-collector">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-collector"
          >
            Remove Collector
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Collectors({ audience = "collectors" }: { audience?: "collectors" | "auditors" }) {
  const isAuditorView = audience === "auditors";
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [collectorToDelete, setCollectorToDelete] = useState<Collector | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: collectors, isLoading } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const currentCollector = collectors?.find((c) => c.id === authUser?.id);
  const showFinancials = currentCollector?.canViewFinancials === true;

  // "Company Accounts" is a built-in placeholder, not a real collector -
  // keep it out of this management page entirely (nothing here applies to
  // it), even though it still appears normally in reporting/liquidation.
  const manageableCollectors = collectors?.filter((c) =>
    !c.isSystemAccount && (isAuditorView ? c.role === "auditor" : c.role !== "auditor")
  );

  const deleteCollectorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/collectors/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      toast({ title: "Collector removed", description: "Collector has been removed." });
    },
  });

  const filteredCollectors = manageableCollectors?.filter((collector) => {
    return (
      searchQuery === "" ||
      collector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (collector.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      collector.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const activeCollectors = manageableCollectors?.filter((c) => c.status === "active").length || 0;
  const totalSeats = manageableCollectors?.length || 0;
  const totalGoal = manageableCollectors?.reduce((sum, c) => sum + (c.goal || 0), 0) || 0;

  const collectorInstallUrl = typeof window !== "undefined"
    ? `${window.location.origin}/collector-install`
    : "/collector-install";

  useEffect(() => {
    if (showQrDialog && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, collectorInstallUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#09090b", light: "#ffffff" },
      });
    }
  }, [showQrDialog, collectorInstallUrl]);

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "collector-app-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{isAuditorView ? "Auditors" : "Collectors"}</h1>
          <p className="text-sm text-muted-foreground">{isAuditorView ? "Manage administrative reviewers and their client access" : "Manage collectors and their assignments"}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-collector">
          <Plus className="h-4 w-4 mr-2" />
          Add {isAuditorView ? "Auditor" : "Collector"}
        </Button>
      </div>

      {!isAuditorView && <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Collector App Link</p>
          <a
            href={collectorInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={collectorInstallUrl}
            className="text-xs truncate block hover:underline text-foreground"
            data-testid="text-collector-install-url"
          >
            {collectorInstallUrl}
          </a>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(collectorInstallUrl);
            toast({ title: "Copied!", description: "Collector app link copied to clipboard." });
          }}
          data-testid="button-copy-collector-install-url"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowQrDialog(true)}
          data-testid="button-show-qr-code"
        >
          <QrCode className="h-3 w-3 mr-1" />
          QR Code
        </Button>
      </div>}

      {!isAuditorView && <div className="grid gap-4 md:grid-cols-3">
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
      </div>}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${isAuditorView ? "auditors" : "collectors"}...`}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`collector-menu-${collector.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingCollector(collector)}
                            data-testid={`button-edit-collector-${collector.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setCollectorToDelete(collector)}
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
                      {showFinancials && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-mono">{formatCurrency(collector.hourlyWage || 0)}/hr</span>
                        </div>
                      )}
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
              <h3 className="text-lg font-medium mb-1">No {isAuditorView ? "auditors" : "collectors"} found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search"
                  : `Get started by adding your first ${isAuditorView ? "auditor" : "collector"}`}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {isAuditorView ? "Auditor" : "Collector"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCollectorDialog open={showAddDialog} onOpenChange={setShowAddDialog} showFinancials={showFinancials} initialRole={isAuditorView ? "auditor" : "collector"} />
      <EditCollectorDialog
        collector={editingCollector}
        onClose={() => setEditingCollector(null)}
        showFinancials={showFinancials}
      />

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Collector App QR Code</DialogTitle>
            <DialogDescription>
              Collectors can scan this code to download and install the app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg border p-3 bg-white">
              <canvas ref={qrCanvasRef} data-testid="qr-code-canvas" />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all px-2">
              {collectorInstallUrl}
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowQrDialog(false)}
              className="sm:mr-auto"
            >
              Close
            </Button>
            <Button onClick={handleDownloadQr} data-testid="button-download-qr">
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemoveCollectorDialog
        collector={collectorToDelete}
        onOpenChange={(open) => { if (!open) setCollectorToDelete(null); }}
        onConfirm={() => {
          if (collectorToDelete) deleteCollectorMutation.mutate(collectorToDelete.id);
          setCollectorToDelete(null);
        }}
        isRemoving={deleteCollectorMutation.isPending}
      />
    </div>
  );
}
