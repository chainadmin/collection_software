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
import { Banknote, Plus, CreditCard, Building, Settings, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Merchant } from "@shared/schema";

export default function Merchants() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [merchantType, setMerchantType] = useState("ach");
  const [merchantId, setMerchantId] = useState("");

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  const handleAddMerchant = () => {
    if (!merchantName || !merchantId) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    toast({ title: "Merchant Added", description: `${merchantName} has been added successfully.` });
    setShowAddDialog(false);
    setMerchantName("");
    setMerchantId("");
  };

  const sampleMerchants = [
    { id: "1", name: "Primary ACH Processor", type: "ach", merchantId: "ACH-001234", isActive: true, monthlyVolume: 125000000 },
    { id: "2", name: "Card Processing LLC", type: "card", merchantId: "CC-005678", isActive: true, monthlyVolume: 87500000 },
    { id: "3", name: "Backup ACH Gateway", type: "ach", merchantId: "ACH-009999", isActive: false, monthlyVolume: 0 },
  ];

  const displayMerchants = merchants.length > 0 ? merchants : sampleMerchants;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Merchant Accounts</h1>
          <p className="text-muted-foreground">Manage payment processing accounts</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-merchant">
              <Plus className="h-4 w-4 mr-2" />
              Add Merchant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Merchant Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Merchant Name</Label>
                <Input 
                  placeholder="Enter merchant name"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  data-testid="input-merchant-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={merchantType} onValueChange={setMerchantType}>
                  <SelectTrigger data-testid="select-merchant-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH Processing</SelectItem>
                    <SelectItem value="card">Credit Card</SelectItem>
                    <SelectItem value="check">Check Processing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Merchant ID</Label>
                <Input 
                  placeholder="Enter merchant ID"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  data-testid="input-merchant-id"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddMerchant} data-testid="button-save-merchant">Save Merchant</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Banknote className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Total Merchants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">$2.1M</p>
                <p className="text-sm text-muted-foreground">Monthly Volume</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configured Merchants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayMerchants.map((merchant: any) => (
              <div key={merchant.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-merchant-${merchant.id}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${merchant.isActive ? "bg-primary/10" : "bg-muted"}`}>
                    {merchant.type === "ach" ? (
                      <Building className="h-5 w-5" />
                    ) : (
                      <CreditCard className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{merchant.name}</p>
                      <Badge variant={merchant.isActive ? "default" : "secondary"}>
                        {merchant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {merchant.type.toUpperCase()} - {merchant.merchantId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-mono">${(merchant.monthlyVolume / 100).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Monthly Volume</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={merchant.isActive} />
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
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
