import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Plus,
  MoreHorizontal,
  FolderKanban,
  Users,
  DollarSign,
  TrendingUp,
  Download,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
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
import { formatCurrency, formatCurrencyCompact, formatDate, calculateLiquidationRate } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio, Collector, PortfolioAssignment, Client, FeeSchedule } from "@shared/schema";

const addPortfolioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasePrice: z.number().min(0, "Purchase price must be positive"),
  totalFaceValue: z.number().min(0, "Face value must be positive"),
  totalAccounts: z.number().min(1, "Must have at least 1 account"),
  creditorName: z.string().optional(),
  debtType: z.string().optional(),
  status: z.string().default("active"),
  clientId: z.string().optional().nullable(),
  feeScheduleId: z.string().optional().nullable(),
});

type AddPortfolioForm = z.infer<typeof addPortfolioSchema>;

export default function Portfolios() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: portfolios, isLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: collectors } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: feeSchedules } = useQuery<FeeSchedule[]>({
    queryKey: ["/api/fee-schedules"],
  });

  const form = useForm<AddPortfolioForm>({
    resolver: zodResolver(addPortfolioSchema),
    defaultValues: {
      name: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchasePrice: 0,
      totalFaceValue: 0,
      totalAccounts: 0,
      creditorName: "",
      debtType: "credit_card",
      status: "active",
      clientId: null,
      feeScheduleId: null,
    },
  });

  const addPortfolioMutation = useMutation({
    mutationFn: async (data: AddPortfolioForm) => {
      return apiRequest("POST", "/api/portfolios", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setShowAddDialog(false);
      form.reset();
      toast({ title: "Portfolio added", description: "Portfolio has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create portfolio.", variant: "destructive" });
    },
  });

  const filteredPortfolios = portfolios?.filter((portfolio) => {
    const matchesSearch =
      searchQuery === "" ||
      portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      portfolio.creditorName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || portfolio.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalFaceValue = portfolios?.reduce((sum, p) => sum + p.totalFaceValue, 0) || 0;
  const totalPurchasePrice = portfolios?.reduce((sum, p) => sum + p.purchasePrice, 0) || 0;
  const totalAccounts = portfolios?.reduce((sum, p) => sum + p.totalAccounts, 0) || 0;
  const activePortfolios = portfolios?.filter((p) => p.status === "active").length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Portfolios</h1>
          <p className="text-sm text-muted-foreground">
            Manage debt portfolios and assignments
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-portfolio">
            <Plus className="h-4 w-4 mr-2" />
            Add Portfolio
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Face Value"
          value={formatCurrencyCompact(totalFaceValue)}
          icon={DollarSign}
        />
        <StatCard
          title="Purchase Investment"
          value={formatCurrencyCompact(totalPurchasePrice)}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Accounts"
          value={totalAccounts.toLocaleString()}
          icon={Users}
        />
        <StatCard
          title="Active Portfolios"
          value={activePortfolios.toString()}
          icon={FolderKanban}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search portfolios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-portfolios"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPortfolios && filteredPortfolios.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                    <th className="pb-3 pr-4">Portfolio</th>
                    <th className="pb-3 pr-4">Creditor</th>
                    <th className="pb-3 pr-4">Debt Type</th>
                    <th className="pb-3 pr-4">Face Value</th>
                    <th className="pb-3 pr-4">Purchase Price</th>
                    <th className="pb-3 pr-4">Accounts</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Purchase Date</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPortfolios.map((portfolio) => (
                    <tr
                      key={portfolio.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`portfolio-row-${portfolio.id}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <FolderKanban className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{portfolio.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm">{portfolio.creditorName || "-"}</td>
                      <td className="py-3 pr-4 text-sm capitalize">
                        {portfolio.debtType?.replace("_", " ") || "-"}
                      </td>
                      <td className="py-3 pr-4 text-sm font-mono">
                        {formatCurrency(portfolio.totalFaceValue)}
                      </td>
                      <td className="py-3 pr-4 text-sm font-mono">
                        {formatCurrency(portfolio.purchasePrice)}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {portfolio.totalAccounts.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={portfolio.status} />
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {formatDate(portfolio.purchaseDate)}
                      </td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`portfolio-menu-${portfolio.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Assign Collectors</DropdownMenuItem>
                            <DropdownMenuItem>View Accounts</DropdownMenuItem>
                            <DropdownMenuItem>Export Report</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FolderKanban className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No portfolios found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first portfolio"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Portfolio
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Portfolio</DialogTitle>
            <DialogDescription>
              Enter the portfolio details to add it to the system.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addPortfolioMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Chase Q4 2024" {...field} data-testid="input-portfolio-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Client</SelectItem>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="feeScheduleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Schedule</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-fee-schedule">
                            <SelectValue placeholder="Select fee schedule" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Fee Schedule</SelectItem>
                          {feeSchedules?.filter(f => f.isActive).map((fee) => (
                            <SelectItem key={fee.id} value={fee.id}>
                              {fee.name} ({(fee.feePercentage || 0) / 100}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="creditorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creditor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chase Bank" {...field} data-testid="input-creditor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="debtType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Debt Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-debt-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="personal_loan">Personal Loan</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalFaceValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Face Value ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                          data-testid="input-face-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                          data-testid="input-purchase-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalAccounts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Accounts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value || "0"))}
                          data-testid="input-total-accounts"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-purchase-date" />
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
                <Button type="submit" disabled={addPortfolioMutation.isPending} data-testid="button-submit-portfolio">
                  {addPortfolioMutation.isPending ? "Adding..." : "Add Portfolio"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
