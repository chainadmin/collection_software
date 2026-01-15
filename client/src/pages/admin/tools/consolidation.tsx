import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Search, Link2, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Debtor } from "@shared/schema";

export default function Consolidation() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [primaryAccount, setPrimaryAccount] = useState<string | null>(null);

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const activeDebtors = debtors.filter((d) => d.status !== "closed" && d.status !== "settled");

  const filteredDebtors = activeDebtors.filter((d) => {
    if (!searchTerm) return false;
    return d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ssn?.includes(searchTerm) ||
      d.ssnLast4?.includes(searchTerm) ||
      d.accountNumber.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const toggleAccount = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      if (primaryAccount === id) setPrimaryAccount(null);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  const setPrimary = (id: string) => {
    setPrimaryAccount(id);
    const newSelected = new Set(selectedAccounts);
    newSelected.add(id);
    setSelectedAccounts(newSelected);
  };

  const handleConsolidate = () => {
    if (selectedAccounts.size < 2) {
      toast({ title: "Error", description: "Select at least 2 accounts to consolidate.", variant: "destructive" });
      return;
    }
    if (!primaryAccount) {
      toast({ title: "Error", description: "Please select a primary account.", variant: "destructive" });
      return;
    }
    const totalBalance = Array.from(selectedAccounts)
      .map((id) => debtors.find((d) => d.id === id)?.currentBalance || 0)
      .reduce((a, b) => a + b, 0);
    
    toast({ 
      title: "Accounts Consolidated", 
      description: `${selectedAccounts.size} accounts merged. Total balance: ${formatCurrency(totalBalance)}` 
    });
    setSelectedAccounts(new Set());
    setPrimaryAccount(null);
  };

  const selectedDebtors = Array.from(selectedAccounts).map((id) => debtors.find((d) => d.id === id)).filter(Boolean) as Debtor[];
  const totalSelectedBalance = selectedDebtors.reduce((sum, d) => sum + d.currentBalance, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Consolidation</h1>
        <p className="text-muted-foreground">Merge multiple accounts for the same debtor</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Find Accounts to Consolidate</CardTitle>
            <CardDescription>Search by name or SSN to find related accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, SSN, or account number..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            <div className="border rounded-md divide-y max-h-[400px] overflow-auto">
              {searchTerm.length < 2 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Enter at least 2 characters to search</p>
                </div>
              ) : filteredDebtors.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No matching accounts found</p>
                </div>
              ) : (
                filteredDebtors.map((debtor) => (
                  <div 
                    key={debtor.id} 
                    className={`flex items-center gap-4 p-3 hover-elevate cursor-pointer ${primaryAccount === debtor.id ? "bg-primary/10" : ""}`}
                    data-testid={`row-account-${debtor.id}`}
                  >
                    <Checkbox 
                      checked={selectedAccounts.has(debtor.id)}
                      onCheckedChange={() => toggleAccount(debtor.id)}
                    />
                    <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                      <div>
                        <p className="font-medium">{debtor.firstName} {debtor.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{debtor.ssn || "***-**-" + debtor.ssnLast4}</p>
                      </div>
                      <div>
                        <p className="text-sm font-mono">{debtor.accountNumber}</p>
                        <p className="text-xs text-muted-foreground">{debtor.fileNumber}</p>
                      </div>
                      <div>
                        <Badge variant="outline">{debtor.status}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(debtor.currentBalance)}</p>
                      </div>
                    </div>
                    <Button 
                      variant={primaryAccount === debtor.id ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrimary(debtor.id);
                      }}
                      data-testid={`button-set-primary-${debtor.id}`}
                    >
                      {primaryAccount === debtor.id ? "Primary" : "Set Primary"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Consolidation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedAccounts.size === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select accounts to consolidate</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Selected Accounts</Label>
                  <div className="space-y-1">
                    {selectedDebtors.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-sm p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {primaryAccount === d.id && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                          <span>{d.firstName} {d.lastName}</span>
                        </div>
                        <span className="font-mono text-xs">{formatCurrency(d.currentBalance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Accounts to Merge:</span>
                    <span className="font-medium">{selectedAccounts.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Combined Balance:</span>
                    <span className="font-mono font-medium">{formatCurrency(totalSelectedBalance)}</span>
                  </div>
                </div>
                <Button 
                  onClick={handleConsolidate}
                  disabled={selectedAccounts.size < 2 || !primaryAccount}
                  className="w-full"
                  data-testid="button-consolidate"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Consolidate Accounts
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
