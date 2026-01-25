import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Search,
  Plus,
  Filter,
  ChevronDown,
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  Download,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCurrency, formatDate, formatPhone } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Debtor, Portfolio, Collector } from "@shared/schema";

const addDebtorSchema = z.object({
  portfolioId: z.string().min(1, "Portfolio is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  ssnLast4: z.string().max(4).optional(),
  originalBalance: z.number().min(0, "Balance must be positive"),
  currentBalance: z.number().min(0, "Balance must be positive"),
  status: z.string().default("open"),
});

type AddDebtorForm = z.infer<typeof addDebtorSchema>;

export default function Debtors() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 300);

  const { data: debtors, isLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors/search", debouncedSearchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/debtors/search?q=${encodeURIComponent(debouncedSearchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedSearchQuery.length > 0,
  });

  const { data: portfolios } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const form = useForm<AddDebtorForm>({
    resolver: zodResolver(addDebtorSchema),
    defaultValues: {
      portfolioId: "",
      accountNumber: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      ssnLast4: "",
      originalBalance: 0,
      currentBalance: 0,
      status: "open",
    },
  });

  const addDebtorMutation = useMutation({
    mutationFn: async (data: AddDebtorForm) => {
      return apiRequest("POST", "/api/debtors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "Debtor added",
        description: "The debtor has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add debtor. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredDebtors = useMemo(() => {
    const baseList = debouncedSearchQuery.length > 0 ? (searchResults || []) : (debtors || []);
    return baseList.filter((debtor) => {
      const matchesStatus = statusFilter === "all" || debtor.status === statusFilter;
      return matchesStatus;
    });
  }, [debtors, searchResults, debouncedSearchQuery, statusFilter]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Debtors</h1>
          <p className="text-sm text-muted-foreground">
            Manage and work debtor accounts
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-debtor">
            <Plus className="h-4 w-4 mr-2" />
            Add Debtor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, SSN, address, employer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-debtors"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_payment">In Payment</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
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
          ) : filteredDebtors && filteredDebtors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                    <th className="pb-3 pr-4">Account #</th>
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Original Balance</th>
                    <th className="pb-3 pr-4">Current Balance</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Last Contact</th>
                    <th className="pb-3 pr-4">Follow Up</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebtors.map((debtor) => (
                    <tr
                      key={debtor.id}
                      className="border-b last:border-0 hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/debtors/${debtor.id}`)}
                      data-testid={`debtor-row-${debtor.id}`}
                    >
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono">{debtor.accountNumber}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="text-sm font-medium">
                            {debtor.firstName} {debtor.lastName}
                          </p>
                          {debtor.dateOfBirth && (
                            <p className="text-xs text-muted-foreground">
                              DOB: {formatDate(debtor.dateOfBirth)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono">
                          {formatCurrency(debtor.originalBalance)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono font-medium">
                          {formatCurrency(debtor.currentBalance)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={debtor.status} />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm text-muted-foreground">
                          {debtor.lastContactDate ? formatDate(debtor.lastContactDate) : "-"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {debtor.nextFollowUpDate ? formatDate(debtor.nextFollowUpDate) : "-"}
                        </div>
                      </td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`debtor-menu-${debtor.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/debtors/${debtor.id}`}>
                                <Phone className="h-4 w-4 mr-2" />
                                Work Account
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Letter
                            </DropdownMenuItem>
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
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No debtors found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first debtor"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Debtor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Debtor</DialogTitle>
            <DialogDescription>
              Enter the debtor's information to add them to the system.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addDebtorMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="portfolioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-portfolio">
                          <SelectValue placeholder="Select portfolio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {portfolios?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ACC-001234" {...field} data-testid="input-account-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ssnLast4"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSN (Last 4)</FormLabel>
                      <FormControl>
                        <Input placeholder="1234" maxLength={4} {...field} data-testid="input-ssn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="originalBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Balance ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                          data-testid="input-original-balance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
                          data-testid="input-current-balance"
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
                <Button type="submit" disabled={addDebtorMutation.isPending} data-testid="button-submit-debtor">
                  {addDebtorMutation.isPending ? "Adding..." : "Add Debtor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
