import { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio, Collector, Client, FeeSchedule } from "@shared/schema";
import { parseCSV, autoMapColumns, systemFields } from "@/lib/csv-import";

type ImportResponse = {
  message?: string;
  created?: number;
  updated?: number;
  linked?: number;
  errors?: string[];
};

type UpdatePortfolioPayload = {
  name: string;
  clientId: string | null;
  feeScheduleId: string | null;
  creditorName: string | null;
  debtType: string | null;
  status: string;
  purchasePrice: number;
  purchaseDate: string;
};

const editPortfolioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  clientId: z.string().nullable().optional(),
  feeScheduleId: z.string().nullable().optional(),
  creditorName: z.string().optional(),
  debtType: z.string().optional(),
  status: z.string().default("active"),
  purchasePrice: z.number().min(0).default(0),
  purchaseDate: z.string().min(1, "Purchase date is required"),
});

type EditPortfolioForm = z.infer<typeof editPortfolioSchema>;

export default function Portfolios() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Add wizard state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState<"name" | "import">("name");
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newPortfolioId, setNewPortfolioId] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importClientId, setImportClientId] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  // Refs avoid stale closures during async create/import vs dialog close.
  const importDoneRef = useRef(false);
  const importStartedRef = useRef(false);
  const dialogOpenRef = useRef(false);
  const newPortfolioIdRef = useRef<string | null>(null);

  // Edit dialog state
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

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

  const editForm = useForm<EditPortfolioForm>({
    resolver: zodResolver(editPortfolioSchema),
    defaultValues: {
      name: "",
      clientId: null,
      feeScheduleId: null,
      creditorName: "",
      debtType: "",
      status: "active",
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
    },
  });

  const resetWizard = () => {
    setWizardStep("name");
    setNewPortfolioName("");
    setNewPortfolioId(null);
    newPortfolioIdRef.current = null;
    setImportDone(false);
    importDoneRef.current = false;
    importStartedRef.current = false;
    setImportClientId("");
    setImportFile(null);
    setCsvColumns([]);
    setCsvData([]);
    setColumnMappings({});
  };

  const deletePortfolioSilently = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/portfolios/${id}`);
    } catch {
      // best-effort cleanup; ignore failures
    } finally {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    }
  };

  const createPortfolioMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/portfolios", {
        name,
        purchaseDate: new Date().toISOString().split("T")[0],
        purchasePrice: 0,
        totalFaceValue: 0,
        totalAccounts: 0,
        status: "active",
      });
      return (await res.json()) as Portfolio;
    },
    onSuccess: (portfolio) => {
      // Race guard: if user closed the dialog before create finished,
      // immediately delete the orphan shell and DO NOT mutate wizard state.
      if (!dialogOpenRef.current) {
        deletePortfolioSilently(portfolio.id);
        return;
      }
      newPortfolioIdRef.current = portfolio.id;
      setNewPortfolioId(portfolio.id);
      setWizardStep("import");
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create portfolio.", variant: "destructive" });
    },
  });

  const importDebtorsMutation = useMutation<
    ImportResponse,
    Error,
    {
      portfolioId: string;
      clientId: string;
      records: Record<string, string>[];
      mappings: Record<string, string>;
    }
  >({
    mutationFn: async (vars) => {
      importStartedRef.current = true;
      const res = await apiRequest("POST", "/api/import/debtors", {
        portfolioId: vars.portfolioId,
        clientId: vars.clientId,
        records: vars.records,
        mappings: vars.mappings,
        fileNumberStart: 1,
      });
      return (await res.json()) as ImportResponse;
    },
    onSuccess: (data) => {
      importDoneRef.current = true;
      setImportDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      toast({
        title: "Portfolio Created",
        description: data.message || "Accounts imported successfully.",
      });
      setShowAddDialog(false);
      resetWizard();
    },
    onError: (err) => {
      // Import failed — keep the shell; user may retry.
      importStartedRef.current = false;
      toast({
        title: "Import Failed",
        description: err.message || "Could not import accounts.",
        variant: "destructive",
      });
    },
  });


  const updatePortfolioMutation = useMutation<
    Portfolio,
    Error,
    { id: string; data: UpdatePortfolioPayload }
  >({
    mutationFn: async (vars) => {
      const res = await apiRequest("PATCH", `/api/portfolios/${vars.id}`, vars.data);
      return (await res.json()) as Portfolio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setEditingPortfolio(null);
      toast({ title: "Portfolio updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update portfolio.", variant: "destructive" });
    },
  });

  // Track dialog open state in a ref so async create/import callbacks can
  // detect close without depending on stale state.
  useEffect(() => {
    dialogOpenRef.current = showAddDialog;
    if (!showAddDialog) {
      // Use the ref so a late-arriving create-success that happened to flush
      // setState before this effect ran is still picked up. The create
      // success handler also short-circuits and deletes the shell directly
      // when the dialog is closed; this is a defense-in-depth pass.
      const id = newPortfolioIdRef.current;
      const wasImported = importDoneRef.current;
      const importInFlight = importStartedRef.current && !importDoneRef.current;
      if (id && !wasImported && !importInFlight) {
        deletePortfolioSilently(id);
      }
      resetWizard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddDialog]);

  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    if (!file) {
      setCsvColumns([]);
      setCsvData([]);
      setColumnMappings({});
      return;
    }
    const text = await file.text();
    const { columns, data } = parseCSV(text);
    setCsvColumns(columns);
    setCsvData(data);
    setColumnMappings(autoMapColumns(columns));
  };

  const handleSubmitName = () => {
    const name = newPortfolioName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Please enter a portfolio name.", variant: "destructive" });
      return;
    }
    createPortfolioMutation.mutate(name);
  };

  const handleRunImport = () => {
    if (!newPortfolioId) return;
    if (!importClientId) {
      toast({ title: "Client required", description: "Please choose a client for these accounts.", variant: "destructive" });
      return;
    }
    if (!importFile || csvData.length === 0) {
      toast({ title: "File required", description: "Please upload a CSV file to import.", variant: "destructive" });
      return;
    }
    const hasMapping = Object.values(columnMappings).some((v) => v && v !== "skip");
    if (!hasMapping) {
      toast({ title: "Map at least one column", description: "Map at least one CSV column to a system field.", variant: "destructive" });
      return;
    }
    const records = csvData.map((row) => {
      const record: Record<string, string> = {};
      csvColumns.forEach((col, idx) => {
        record[col] = row[idx] || "";
      });
      return record;
    });
    importDebtorsMutation.mutate({
      portfolioId: newPortfolioId,
      clientId: importClientId,
      records,
      mappings: columnMappings,
    });
  };

  const openEditDialog = (portfolio: Portfolio) => {
    editForm.reset({
      name: portfolio.name,
      clientId: portfolio.clientId ?? null,
      feeScheduleId: portfolio.feeScheduleId ?? null,
      creditorName: portfolio.creditorName ?? "",
      debtType: portfolio.debtType ?? "",
      status: portfolio.status,
      purchasePrice: portfolio.purchasePrice ?? 0,
      purchaseDate: portfolio.purchaseDate,
    });
    setEditingPortfolio(portfolio);
  };

  const submitEdit = (data: EditPortfolioForm) => {
    if (!editingPortfolio) return;
    updatePortfolioMutation.mutate({
      id: editingPortfolio.id,
      data: {
        name: data.name,
        clientId: data.clientId || null,
        feeScheduleId: data.feeScheduleId || null,
        creditorName: data.creditorName || null,
        debtType: data.debtType || null,
        status: data.status,
        purchasePrice: data.purchasePrice ?? 0,
        purchaseDate: data.purchaseDate,
      },
    });
  };

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
        <StatCard title="Total Face Value" value={formatCurrencyCompact(totalFaceValue)} icon={DollarSign} />
        <StatCard title="Purchase Investment" value={formatCurrencyCompact(totalPurchasePrice)} icon={TrendingUp} />
        <StatCard title="Total Accounts" value={totalAccounts.toLocaleString()} icon={Users} />
        <StatCard title="Active Portfolios" value={activePortfolios.toString()} icon={FolderKanban} />
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(portfolio)}
                            data-testid={`button-edit-portfolio-${portfolio.id}`}
                            title="Edit portfolio"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`portfolio-menu-${portfolio.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(portfolio)} data-testid={`menu-edit-portfolio-${portfolio.id}`}>
                                Edit Portfolio
                              </DropdownMenuItem>
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Assign Collectors</DropdownMenuItem>
                              <DropdownMenuItem>View Accounts</DropdownMenuItem>
                              <DropdownMenuItem>Export Report</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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

      {/* Add Portfolio Wizard */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className={wizardStep === "import" ? "max-w-3xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>
              {wizardStep === "name" ? "Add New Portfolio" : `Import Accounts into "${newPortfolioName}"`}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === "name"
                ? "Step 1 of 2 — name your portfolio. Totals will be calculated from the imported file."
                : "Step 2 of 2 — pick the client these accounts belong to, upload your CSV, and map the columns."}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === "name" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Portfolio Name *</Label>
                <Input
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="e.g., Chase Q4 2024"
                  data-testid="input-portfolio-name"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Face value, account count, and other details will be filled in from your CSV.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitName}
                  disabled={createPortfolioMutation.isPending || !newPortfolioName.trim()}
                  data-testid="button-continue-import"
                >
                  {createPortfolioMutation.isPending ? "Creating..." : "Continue"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {wizardStep === "import" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={importClientId} onValueChange={setImportClientId}>
                  <SelectTrigger data-testid="select-import-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {!clients || clients.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No clients available — create one in Clients first
                      </SelectItem>
                    ) : (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>CSV File *</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                    id="portfolio-import-file"
                    data-testid="input-portfolio-import-file"
                  />
                  <label htmlFor="portfolio-import-file" className="cursor-pointer">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      {importFile ? importFile.name : "Click to select a CSV file"}
                    </p>
                    <p className="text-xs text-muted-foreground">CSV files only</p>
                  </label>
                </div>
                {importFile && csvColumns.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {csvColumns.length} columns, {csvData.length} rows detected. Columns auto-mapped where possible — review below.
                  </p>
                )}
              </div>

              {csvColumns.length > 0 && (
                <div className="space-y-2">
                  <Label>Column Mapping</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-3 gap-3 px-3 py-2 bg-muted text-xs font-medium">
                      <span>CSV Column</span>
                      <span>Sample</span>
                      <span>Map To</span>
                    </div>
                    <div className="divide-y max-h-64 overflow-y-auto">
                      {csvColumns.map((col, idx) => (
                        <div key={col} className="grid grid-cols-3 gap-3 px-3 py-2 items-center">
                          <span className="text-xs font-mono truncate" title={col}>{col}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {csvData[0]?.[idx] || "-"}
                          </span>
                          <Select
                            value={columnMappings[col] || "skip"}
                            onValueChange={(val) =>
                              setColumnMappings({ ...columnMappings, [col]: val })
                            }
                          >
                            <SelectTrigger data-testid={`select-mapping-${col}`} className="h-8 text-xs">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {systemFields.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="flex justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  data-testid="button-cancel-import"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleRunImport}
                  disabled={
                    importDebtorsMutation.isPending ||
                    !importClientId ||
                    !importFile ||
                    csvColumns.length === 0
                  }
                  data-testid="button-run-import"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importDebtorsMutation.isPending
                    ? "Importing..."
                    : `Import ${csvData.length} Account${csvData.length === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Portfolio Dialog */}
      <Dialog open={!!editingPortfolio} onOpenChange={(open) => !open && setEditingPortfolio(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
            <DialogDescription>
              Update optional details. Face value and account count are calculated from imports.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(submitEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-portfolio-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Client</SelectItem>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="feeScheduleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Schedule</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-fee-schedule">
                            <SelectValue placeholder="Select fee schedule" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Fee Schedule</SelectItem>
                          {feeSchedules
                            ?.filter((f) => f.isActive)
                            .map((fee) => (
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
                  control={editForm.control}
                  name="creditorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creditor Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Chase Bank"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-edit-creditor-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="debtType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Debt Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-debt-type">
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
                  control={editForm.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={
                            field.value === undefined || field.value === null
                              ? ""
                              : (field.value / 100).toFixed(2)
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            field.onChange(
                              raw === "" ? 0 : Math.round(parseFloat(raw) * 100),
                            );
                          }}
                          data-testid="input-edit-purchase-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-purchase-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPortfolio(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updatePortfolioMutation.isPending}
                  data-testid="button-save-edit-portfolio"
                >
                  {updatePortfolioMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
