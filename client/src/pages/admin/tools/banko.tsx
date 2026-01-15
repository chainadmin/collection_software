import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Scale, Search, FileText, AlertCircle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Debtor } from "@shared/schema";

export default function Banko() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [bankruptcyType, setBankruptcyType] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [filingDate, setFilingDate] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const bankruptDebtors = debtors.filter((d) => d.status === "bankruptcy");
  const activeDebtors = debtors.filter((d) => d.status !== "bankruptcy" && d.status !== "closed" && d.status !== "settled");

  const filteredActive = activeDebtors.filter((d) => {
    if (!searchTerm) return true;
    return d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ssn?.includes(searchTerm);
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

  const handleMarkBankruptcy = () => {
    if (selectedAccounts.size === 0) {
      toast({ title: "Error", description: "Please select accounts.", variant: "destructive" });
      return;
    }
    if (!bankruptcyType || !caseNumber) {
      toast({ title: "Error", description: "Please fill in bankruptcy details.", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Bankruptcy Filed", 
      description: `${selectedAccounts.size} accounts marked as Chapter ${bankruptcyType} bankruptcy.` 
    });
    setSelectedAccounts(new Set());
    setCaseNumber("");
    setFilingDate("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bankruptcy Management</h1>
          <p className="text-muted-foreground">Track and manage bankruptcy filings</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <Scale className="h-3 w-3 mr-1" />
            {bankruptDebtors.length} Active Bankruptcies
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              File Bankruptcy
            </CardTitle>
            <CardDescription>Mark accounts with bankruptcy status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bankruptcy Type</Label>
              <Select value={bankruptcyType} onValueChange={setBankruptcyType}>
                <SelectTrigger data-testid="select-bankruptcy-type">
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Chapter 7 - Liquidation</SelectItem>
                  <SelectItem value="11">Chapter 11 - Reorganization</SelectItem>
                  <SelectItem value="13">Chapter 13 - Wage Earner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Case Number</Label>
              <Input 
                placeholder="XX-XXXXX"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                data-testid="input-case-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Filing Date</Label>
              <Input 
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                data-testid="input-filing-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Search Accounts</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Name, SSN, account..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Button 
              onClick={handleMarkBankruptcy}
              disabled={selectedAccounts.size === 0}
              className="w-full"
              data-testid="button-file-bankruptcy"
            >
              <Scale className="h-4 w-4 mr-2" />
              File Bankruptcy ({selectedAccounts.size})
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Accounts</CardTitle>
            <CardDescription>Select accounts to mark as bankruptcy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y max-h-[300px] overflow-auto">
              {filteredActive.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No matching accounts</p>
                </div>
              ) : (
                filteredActive.map((debtor) => (
                  <div 
                    key={debtor.id} 
                    className="flex items-center gap-3 p-2 hover-elevate cursor-pointer"
                    onClick={() => toggleAccount(debtor.id)}
                    data-testid={`row-account-${debtor.id}`}
                  >
                    <Checkbox checked={selectedAccounts.has(debtor.id)} />
                    <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                      <span className="font-medium">{debtor.firstName} {debtor.lastName}</span>
                      <span className="font-mono text-muted-foreground">{debtor.ssn || "***-**-" + debtor.ssnLast4}</span>
                      <span className="font-mono">{debtor.accountNumber}</span>
                      <span className="text-right font-mono">{formatCurrency(debtor.currentBalance)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Current Bankruptcies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bankruptDebtors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No accounts currently in bankruptcy</p>
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {bankruptDebtors.map((debtor) => (
                <div key={debtor.id} className="flex items-center justify-between p-3" data-testid={`row-bankruptcy-${debtor.id}`}>
                  <div className="flex items-center gap-4">
                    <Badge variant="destructive">BK</Badge>
                    <div>
                      <p className="font-medium">{debtor.firstName} {debtor.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{debtor.accountNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{formatCurrency(debtor.currentBalance)}</p>
                    <p className="text-xs text-muted-foreground">{debtor.originalCreditor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
