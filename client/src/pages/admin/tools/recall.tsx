import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Search, RotateCcw, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Debtor, Portfolio } from "@shared/schema";

export default function Recall() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [recallReason, setRecallReason] = useState("");

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
      d.accountNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPortfolio && matchesSearch;
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

  const handleRecall = () => {
    if (selectedAccounts.size === 0) {
      toast({ title: "Error", description: "Please select accounts to recall.", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Recall Initiated", 
      description: `${selectedAccounts.size} accounts have been marked for recall to client.` 
    });
    setSelectedAccounts(new Set());
    setRecallReason("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recall Accounts</h1>
          <p className="text-muted-foreground">Return accounts to the original client/creditor</p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {selectedAccounts.size} Selected
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
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
              <Label>Recall Reason</Label>
              <Select value={recallReason} onValueChange={setRecallReason}>
                <SelectTrigger data-testid="select-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_request">Client Request</SelectItem>
                  <SelectItem value="unworkable">Unworkable Account</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                  <SelectItem value="wrong_party">Wrong Party</SelectItem>
                  <SelectItem value="statute_expired">Statute Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search accounts..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Button 
              onClick={handleRecall}
              disabled={selectedAccounts.size === 0 || !recallReason}
              className="w-full"
              data-testid="button-recall"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Recall Selected
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accounts Available for Recall</CardTitle>
            <CardDescription>{filteredDebtors.length} accounts found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y max-h-[500px] overflow-auto">
              {filteredDebtors.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                    <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="font-medium">{debtor.firstName} {debtor.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{debtor.fileNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-mono">{debtor.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm">{debtor.originalCreditor || "N/A"}</p>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
