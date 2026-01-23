import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Search, RotateCcw, Star, StarOff, CalendarCheck, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Debtor, Portfolio, Payment, Client } from "@shared/schema";

export default function Recall() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [recallReason, setRecallReason] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments/recent"],
    queryFn: async () => {
      const res = await fetch("/api/payments/recent?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const filteredPortfolios = useMemo(() => {
    if (selectedClientId === "all") return portfolios;
    return portfolios.filter((p) => p.clientId === selectedClientId);
  }, [portfolios, selectedClientId]);

  const hasPaymentsOnFile = (debtorId: string) => {
    return payments.some((p) => p.debtorId === debtorId);
  };

  const isKeeper = (debtor: Debtor) => {
    return hasPaymentsOnFile(debtor.id) || debtor.status === "in_payment" || debtor.status === "promise";
  };

  const isMonthlyPayor = (debtorId: string) => {
    const debtorPayments = payments.filter((p) => p.debtorId === debtorId && p.isRecurring);
    return debtorPayments.length > 0;
  };

  const filteredDebtors = useMemo(() => {
    let result = [...debtors];

    if (selectedPortfolioId !== "all") {
      result = result.filter((d) => d.portfolioId === selectedPortfolioId);
    } else if (selectedClientId !== "all") {
      const clientPortfolioIds = portfolios
        .filter((p) => p.clientId === selectedClientId)
        .map((p) => p.id);
      result = result.filter((d) => clientPortfolioIds.includes(d.portfolioId));
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.firstName.toLowerCase().includes(search) ||
          d.lastName.toLowerCase().includes(search) ||
          d.accountNumber.toLowerCase().includes(search) ||
          (d.fileNumber && d.fileNumber.toLowerCase().includes(search))
      );
    }

    if (recallReason === "recall") {
      result = result.filter((d) => !isKeeper(d));
    } else if (recallReason === "monthly_payors") {
      result = result.filter((d) => isMonthlyPayor(d.id));
    }

    return result;
  }, [debtors, selectedClientId, selectedPortfolioId, portfolios, searchTerm, recallReason, payments]);

  const getPortfolioName = (portfolioId: string) => {
    return portfolios.find((p) => p.id === portfolioId)?.name || "Unknown";
  };

  const getClientName = (portfolioId: string) => {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return "Unknown";
    return clients.find((c) => c.id === portfolio.clientId)?.name || "Unknown";
  };

  const toggleAccount = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAccounts.size === filteredDebtors.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(filteredDebtors.map((d) => d.id)));
    }
  };

  const handleRecall = () => {
    if (selectedAccounts.size === 0) {
      toast({ title: "Error", description: "Please select accounts to recall.", variant: "destructive" });
      return;
    }
    if (!recallReason) {
      toast({ title: "Error", description: "Please select a recall reason.", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Recall Initiated", 
      description: `${selectedAccounts.size} accounts have been marked for recall to client.` 
    });
    setSelectedAccounts(new Set());
    setRecallReason("");
  };

  const handleClientChange = (value: string) => {
    setSelectedClientId(value);
    setSelectedPortfolioId("all");
  };

  const recallCount = filteredDebtors.filter((d) => !isKeeper(d)).length;
  const monthlyPayorCount = filteredDebtors.filter((d) => isMonthlyPayor(d.id)).length;

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
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={handleClientChange}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Portfolio</Label>
              <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
                <SelectTrigger data-testid="select-portfolio">
                  <SelectValue placeholder="All Portfolios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Portfolios</SelectItem>
                  {filteredPortfolios.map((p) => (
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
                  <SelectItem value="recall">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Recall ({recallCount})
                    </div>
                  </SelectItem>
                  <SelectItem value="monthly_payors">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4" />
                      Monthly Payors ({monthlyPayorCount})
                    </div>
                  </SelectItem>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Accounts Available for Recall</CardTitle>
                <CardDescription>{filteredDebtors.length} accounts found</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll} data-testid="button-select-all">
                {selectedAccounts.size === filteredDebtors.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y max-h-[500px] overflow-auto">
              {filteredDebtors.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No accounts found</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-3 bg-muted text-sm font-medium sticky top-0">
                    <div className="w-6"></div>
                    <div className="w-24">Status</div>
                    <div className="flex-1 grid grid-cols-6 gap-4">
                      <div>Debtor</div>
                      <div>Account #</div>
                      <div>Client</div>
                      <div>Portfolio</div>
                      <div>Creditor</div>
                      <div className="text-right">Balance</div>
                    </div>
                  </div>
                  {filteredDebtors.map((debtor) => (
                    <div 
                      key={debtor.id} 
                      className={`flex items-center gap-4 p-3 hover-elevate cursor-pointer ${
                        isKeeper(debtor) ? "bg-green-50 dark:bg-green-950/20" : ""
                      } ${isMonthlyPayor(debtor.id) ? "border-l-4 border-l-blue-500" : ""}`}
                      onClick={() => toggleAccount(debtor.id)}
                      data-testid={`row-account-${debtor.id}`}
                    >
                      <Checkbox 
                        checked={selectedAccounts.has(debtor.id)}
                        onCheckedChange={() => toggleAccount(debtor.id)}
                      />
                      <div className="w-24 flex items-center gap-2">
                        {isKeeper(debtor) ? (
                          <Star className="h-4 w-4 text-green-600 fill-green-600" />
                        ) : (
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge variant={isKeeper(debtor) ? "default" : "secondary"} className="text-xs">
                          {isKeeper(debtor) ? "KEEP" : "RECALL"}
                        </Badge>
                      </div>
                      <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                        <div>
                          <p className="font-medium text-sm">{debtor.firstName} {debtor.lastName}</p>
                          {isMonthlyPayor(debtor.id) && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                              <CalendarCheck className="h-3 w-3 mr-1" />
                              Monthly
                            </Badge>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-mono">{debtor.accountNumber}</p>
                          {debtor.fileNumber && (
                            <p className="text-xs text-muted-foreground font-mono">{debtor.fileNumber}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm">{getClientName(debtor.portfolioId)}</p>
                        </div>
                        <div>
                          <p className="text-sm">{getPortfolioName(debtor.portfolioId)}</p>
                        </div>
                        <div>
                          <p className="text-sm">{debtor.originalCreditor || "N/A"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">{formatCurrency(debtor.currentBalance)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
