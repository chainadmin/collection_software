import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Edit, Trash2, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio, FeeSchedule } from "@shared/schema";

export default function FeeSchedules() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [feeName, setFeeName] = useState("");
  const [feePercentage, setFeePercentage] = useState("");
  const [feePortfolio, setFeePortfolio] = useState("");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: feeSchedules = [] } = useQuery<FeeSchedule[]>({
    queryKey: ["/api/fee-schedules"],
  });

  const sampleFees = [
    { id: "1", name: "Standard Collection Fee", portfolioId: null, percentage: 25, minAmount: 0, isActive: true },
    { id: "2", name: "Chase Q4 Fee", portfolioId: "54b763d7-575b-4903-9ac2-1fd1102ffb9f", percentage: 20, minAmount: 5000, isActive: true },
    { id: "3", name: "Medical Debt Fee", portfolioId: "680d2426-9946-439b-b00b-de92ad10fc9f", percentage: 30, minAmount: 0, isActive: true },
    { id: "4", name: "Auto Loan Fee", portfolioId: "71b82e2b-4221-4fec-9b92-e4d3dfd2cec0", percentage: 18, minAmount: 10000, isActive: false },
  ];

  const displayFees = feeSchedules.length > 0 ? feeSchedules : sampleFees;

  const getPortfolioName = (portfolioId: string | null) => {
    if (!portfolioId) return "All Portfolios (Default)";
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    return portfolio?.name || "Unknown Portfolio";
  };

  const handleAddFee = () => {
    if (!feeName || !feePercentage) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    toast({ title: "Fee Schedule Added", description: `${feeName} has been created.` });
    setShowAddDialog(false);
    setFeeName("");
    setFeePercentage("");
    setFeePortfolio("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fee Schedules</h1>
          <p className="text-muted-foreground">Configure collection fees by portfolio</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-fee">
              <Plus className="h-4 w-4 mr-2" />
              Add Fee Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Fee Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Fee Name</Label>
                <Input 
                  placeholder="e.g., Standard Collection Fee"
                  value={feeName}
                  onChange={(e) => setFeeName(e.target.value)}
                  data-testid="input-fee-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Portfolio (Optional)</Label>
                <Select value={feePortfolio} onValueChange={setFeePortfolio}>
                  <SelectTrigger data-testid="select-portfolio">
                    <SelectValue placeholder="All Portfolios (Default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Portfolios (Default)</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fee Percentage</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      placeholder="25"
                      value={feePercentage}
                      onChange={(e) => setFeePercentage(e.target.value)}
                      className="pr-8"
                      data-testid="input-fee-percentage"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Amount (cents)</Label>
                  <Input 
                    type="number"
                    placeholder="0"
                    data-testid="input-min-amount"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddFee} data-testid="button-save-fee">Save Fee Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{displayFees.length}</p>
                <p className="text-sm text-muted-foreground">Fee Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Percent className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">23.3%</p>
                <p className="text-sm text-muted-foreground">Avg Fee Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">$580K</p>
                <p className="text-sm text-muted-foreground">Fees This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configured Fee Schedules</CardTitle>
          <CardDescription>Portfolio-specific and default fee rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayFees.map((fee: any) => (
              <div 
                key={fee.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`row-fee-${fee.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${fee.isActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{fee.name}</p>
                      <Badge variant={fee.isActive ? "default" : "secondary"}>
                        {fee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getPortfolioName(fee.portfolioId)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold">{fee.percentage}%</p>
                    <p className="text-xs text-muted-foreground">
                      {fee.minAmount > 0 ? `Min: $${(fee.minAmount / 100).toFixed(2)}` : "No minimum"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={fee.isActive} />
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
