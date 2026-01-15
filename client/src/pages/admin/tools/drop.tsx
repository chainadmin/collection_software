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
import { FileDown, AlertTriangle, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Debtor, Portfolio } from "@shared/schema";

export default function DropAccounts() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [dropReason, setDropReason] = useState("");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const filteredDebtors = debtors.filter((d) => {
    const matchesPortfolio = !selectedPortfolio || d.portfolioId === selectedPortfolio;
    const matchesSearch = !searchTerm || 
      d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.fileNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPortfolio && matchesSearch && d.status !== "closed";
  });

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
    if (selectedAccounts.size === filteredDebtors.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(filteredDebtors.map((d) => d.id)));
    }
  };

  const handleDrop = () => {
    if (selectedAccounts.size === 0) {
      toast({ title: "Error", description: "Please select accounts to drop.", variant: "destructive" });
      return;
    }
    if (!dropReason) {
      toast({ title: "Error", description: "Please provide a reason for dropping.", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Accounts Dropped", 
      description: `${selectedAccounts.size} accounts have been marked for drop with reason: ${dropReason}` 
    });
    setSelectedAccounts(new Set());
    setDropReason("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Drop Accounts</h1>
          <p className="text-muted-foreground">Remove accounts from active collection</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {selectedAccounts.size} Selected
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
                  <SelectItem value="">All Portfolios</SelectItem>
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
            <CardTitle className="text-base flex items-center justify-between">
              <span>Drop Reason</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardTitle>
            <CardDescription>Provide documentation for the drop action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Enter reason for dropping these accounts..."
              value={dropReason}
              onChange={(e) => setDropReason(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-drop-reason"
            />
            <Button 
              variant="destructive" 
              onClick={handleDrop}
              disabled={selectedAccounts.size === 0}
              data-testid="button-drop-accounts"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Drop {selectedAccounts.size} Accounts
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Accounts ({filteredDebtors.length})</span>
            <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all">
              {selectedAccounts.size === filteredDebtors.length ? "Deselect All" : "Select All"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md divide-y max-h-[400px] overflow-auto">
            {filteredDebtors.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No accounts found</p>
              </div>
            ) : (
              filteredDebtors.map((debtor) => (
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
                      <p className="font-mono">${(debtor.currentBalance / 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
