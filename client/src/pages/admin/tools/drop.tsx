import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, Search, Users, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import type { Debtor, Portfolio, Collector } from "@shared/schema";

export default function DropAccounts() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedCollector, setSelectedCollector] = useState<string>("");
  const [dropNotes, setDropNotes] = useState("");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: debtors = [], isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const activeCollectors = collectors.filter((c) => c.status === "active" && c.role !== "admin");

  const dropAccountsMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      portfolioId?: string; 
      notes?: string;
      collectorId: string;
      debtorIds: string[];
    }) => {
      const response = await apiRequest("POST", "/api/drop-batches", {
        name: data.name,
        portfolioId: data.portfolioId,
        notes: data.notes,
        totalAccounts: data.debtorIds.length,
      });
      const batch = await response.json() as { id: string };
      
      const results = { success: 0, failed: 0 };
      for (const debtorId of data.debtorIds) {
        try {
          await apiRequest("POST", "/api/drop-items", {
            dropBatchId: batch.id,
            debtorId,
            collectorId: data.collectorId,
          });
          await apiRequest("PATCH", `/api/debtors/${debtorId}`, { 
            assignedCollectorId: data.collectorId 
          });
          results.success++;
        } catch {
          results.failed++;
        }
      }
      return results;
    },
  });

  const filteredDebtors = debtors.filter((d) => {
    const matchesPortfolio = selectedPortfolio === "all" || !selectedPortfolio || d.portfolioId === selectedPortfolio;
    const matchesSearch = !searchTerm || 
      d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.fileNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const isWorkable = d.status === "open" || d.status === "in_payment";
    return matchesPortfolio && matchesSearch && isWorkable;
  });

  const unassignedDebtors = filteredDebtors.filter((d) => !d.assignedCollectorId);

  const toggleAccount = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  const toggleAll = () => {
    if (selectedAccounts.size === unassignedDebtors.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(unassignedDebtors.map((d) => d.id)));
    }
  };

  const handleDropToCollector = async () => {
    if (selectedAccounts.size === 0) {
      toast({ title: "Error", description: "Please select accounts to drop.", variant: "destructive" });
      return;
    }
    if (!selectedCollector) {
      toast({ title: "Error", description: "Please select a collector.", variant: "destructive" });
      return;
    }

    const batchName = `Drop ${new Date().toISOString().split("T")[0]} - ${selectedAccounts.size} accounts`;
    const results = await dropAccountsMutation.mutateAsync({
      name: batchName,
      portfolioId: selectedPortfolio !== "all" ? selectedPortfolio : undefined,
      notes: dropNotes || undefined,
      collectorId: selectedCollector,
      debtorIds: Array.from(selectedAccounts),
    });

    queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/drop-batches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-queue"] });
    
    const collector = collectors.find((c) => c.id === selectedCollector);
    if (results.failed > 0) {
      toast({ 
        title: "Partial Success", 
        description: `${results.success} accounts assigned to ${collector?.name || "collector"}. ${results.failed} failed.`,
        variant: "destructive"
      });
    } else {
      toast({ 
        title: "Accounts Dropped", 
        description: `${results.success} accounts assigned to ${collector?.name || "collector"}'s work queue.`
      });
    }
    setSelectedAccounts(new Set());
    setDropNotes("");
  };

  const selectedTotal = Array.from(selectedAccounts).reduce((sum, id) => {
    const debtor = debtors.find((d) => d.id === id);
    return sum + (debtor?.currentBalance || 0);
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Drop Accounts to Collectors</h1>
          <p className="text-muted-foreground">Assign accounts to collectors' work queues</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {selectedAccounts.size} Selected ({formatCurrency(selectedTotal)})
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Portfolio</Label>
              <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                <SelectTrigger data-testid="select-portfolio">
                  <SelectValue placeholder="All Portfolios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Portfolios</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Name, account, file #" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign to Collector
            </CardTitle>
            <CardDescription>Select collector to receive accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Collector</Label>
              <Select value={selectedCollector} onValueChange={setSelectedCollector}>
                <SelectTrigger data-testid="select-collector">
                  <SelectValue placeholder="Select a collector" />
                </SelectTrigger>
                <SelectContent>
                  {activeCollectors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea 
              placeholder="Optional notes for this drop..."
              value={dropNotes}
              onChange={(e) => setDropNotes(e.target.value)}
              className="min-h-[60px]"
              data-testid="input-drop-notes"
            />
            <Button 
              onClick={handleDropToCollector}
              disabled={selectedAccounts.size === 0 || !selectedCollector || dropAccountsMutation.isPending}
              data-testid="button-drop-accounts"
            >
              <Send className="h-4 w-4 mr-2" />
              {dropAccountsMutation.isPending ? "Dropping..." : `Drop ${selectedAccounts.size} Accounts`}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Unassigned Accounts ({unassignedDebtors.length})</span>
            <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all">
              {selectedAccounts.size === unassignedDebtors.length ? "Deselect All" : "Select All"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {debtorsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-md divide-y max-h-[400px] overflow-auto">
              {unassignedDebtors.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No unassigned accounts found</p>
                  <p className="text-sm">All accounts are already assigned to collectors</p>
                </div>
              ) : (
                unassignedDebtors.map((debtor) => (
                  <div 
                    key={debtor.id} 
                    className="flex items-center gap-4 p-3 hover-elevate cursor-pointer"
                    onClick={() => toggleAccount(debtor.id)}
                    data-testid={`row-account-${debtor.id}`}
                  >
                    <Checkbox 
                      checked={selectedAccounts.has(debtor.id)}
                      onCheckedChange={() => toggleAccount(debtor.id)}
                    />
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <p className="font-medium">{debtor.firstName} {debtor.lastName}</p>
                        <p className="text-xs text-muted-foreground">{debtor.fileNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-mono">{debtor.accountNumber}</p>
                      </div>
                      <div>
                        <Badge variant="outline">{debtor.status}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(debtor.currentBalance)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
