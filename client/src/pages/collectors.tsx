import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  DollarSign,
  Mail,
  Phone,
  Edit,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/form";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, getInitials } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collector, Portfolio, PortfolioAssignment } from "@shared/schema";

const addCollectorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.string().default("collector"),
  status: z.string().default("active"),
  costPerSeat: z.number().min(0).default(150),
});

type AddCollectorForm = z.infer<typeof addCollectorSchema>;

export default function Collectors() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: collectors, isLoading } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: portfolios } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const form = useForm<AddCollectorForm>({
    resolver: zodResolver(addCollectorSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "collector",
      status: "active",
      costPerSeat: 150,
    },
  });

  const addCollectorMutation = useMutation({
    mutationFn: async (data: AddCollectorForm) => {
      return apiRequest("POST", "/api/collectors", {
        ...data,
        avatarInitials: getInitials(data.name),
        costPerSeat: data.costPerSeat * 100,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      setShowAddDialog(false);
      form.reset();
      toast({ title: "Collector added", description: "Collector seat has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add collector.", variant: "destructive" });
    },
  });

  const deleteCollectorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/collectors/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collectors"] });
      toast({ title: "Collector removed", description: "Collector seat has been removed." });
    },
  });

  const filteredCollectors = collectors?.filter((collector) => {
    return (
      searchQuery === "" ||
      collector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collector.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const activeCollectors = collectors?.filter((c) => c.status === "active").length || 0;
  const totalSeats = collectors?.length || 0;
  const totalMonthlyCost = collectors?.reduce((sum, c) => sum + (c.costPerSeat || 15000), 0) || 0;
  const avgCostPerSeat = totalSeats > 0 ? totalMonthlyCost / totalSeats : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Collectors</h1>
          <p className="text-sm text-muted-foreground">
            Manage collector seats and assignments
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-collector">
          <Plus className="h-4 w-4 mr-2" />
          Add Collector Seat
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Collectors"
          value={activeCollectors.toString()}
          subtitle={`of ${totalSeats} total seats`}
          icon={Users}
        />
        <StatCard
          title="Total Seats"
          value={totalSeats.toString()}
          icon={Users}
        />
        <StatCard
          title="Monthly Cost"
          value={formatCurrency(totalMonthlyCost)}
          icon={DollarSign}
        />
        <StatCard
          title="Avg Cost/Seat"
          value={formatCurrency(avgCostPerSeat)}
          subtitle="per month"
          icon={DollarSign}
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
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Assign Portfolios
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteCollectorMutation.mutate(collector.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{collector.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={collector.status} />
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatCurrency(collector.costPerSeat || 15000)}/mo
                        </span>
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
                  : "Get started by adding your first collector seat"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collector Seat
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Pricing Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <p className="text-2xl font-semibold font-mono">$150</p>
              <p className="text-sm text-muted-foreground">per seat / month</p>
              <p className="text-xs text-muted-foreground mt-1">Standard rate</p>
            </div>
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <p className="text-2xl font-semibold font-mono">$125</p>
              <p className="text-sm text-muted-foreground">per seat / month</p>
              <p className="text-xs text-muted-foreground mt-1">10+ seats</p>
            </div>
            <div className="p-4 rounded-md bg-muted/50 text-center">
              <p className="text-2xl font-semibold font-mono">$100</p>
              <p className="text-sm text-muted-foreground">per seat / month</p>
              <p className="text-xs text-muted-foreground mt-1">25+ seats</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Collector Seat</DialogTitle>
            <DialogDescription>
              Add a new collector seat to your organization.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addCollectorMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
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
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@company.com" {...field} data-testid="input-collector-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPerSeat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost per Seat ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="150"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value || "150"))}
                          data-testid="input-cost-per-seat"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
    </div>
  );
}
