import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, Plus, CreditCard, Building, Settings, CheckCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Merchant } from "@shared/schema";

export default function Merchants() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [processorType, setProcessorType] = useState("nmi");
  const [merchantIdInput, setMerchantIdInput] = useState("");
  const [nmiSecurityKey, setNmiSecurityKey] = useState("");
  const [nmiUsername, setNmiUsername] = useState("");
  const [nmiPassword, setNmiPassword] = useState("");
  const [usaepaySourceKey, setUsaepaySourceKey] = useState("");
  const [usaepayPin, setUsaepayPin] = useState("");
  const [testMode, setTestMode] = useState(true);

  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  const addMerchantMutation = useMutation({
    mutationFn: async (data: Partial<Merchant>) => {
      return apiRequest("POST", "/api/merchants", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Merchant Added", description: "New merchant account has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add merchant.", variant: "destructive" });
    },
  });

  const updateMerchantMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Merchant> }) => {
      return apiRequest("PATCH", `/api/merchants/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      toast({ title: "Merchant Updated", description: "Merchant status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update merchant.", variant: "destructive" });
    },
  });

  const deleteMerchantMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/merchants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      toast({ title: "Merchant Deleted", description: "Merchant has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete merchant.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setMerchantName("");
    setMerchantIdInput("");
    setProcessorType("nmi");
    setNmiSecurityKey("");
    setNmiUsername("");
    setNmiPassword("");
    setUsaepaySourceKey("");
    setUsaepayPin("");
    setTestMode(true);
  };

  const handleAddMerchant = () => {
    if (!merchantName || !merchantIdInput) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    addMerchantMutation.mutate({
      name: merchantName,
      merchantId: merchantIdInput,
      processorType: processorType,
      nmiSecurityKey: processorType === "nmi" ? nmiSecurityKey : null,
      nmiUsername: processorType === "nmi" ? nmiUsername : null,
      nmiPassword: processorType === "nmi" ? nmiPassword : null,
      usaepaySourceKey: processorType === "usaepay" ? usaepaySourceKey : null,
      usaepayPin: processorType === "usaepay" ? usaepayPin : null,
      testMode,
    });
  };

  const handleToggleActive = (merchant: Merchant) => {
    updateMerchantMutation.mutate({
      id: merchant.id,
      updates: { isActive: !merchant.isActive },
    });
  };

  const activeMerchants = merchants.filter((m) => m.isActive);

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
                <Label>Processor</Label>
                <Select value={processorType} onValueChange={setProcessorType}>
                  <SelectTrigger data-testid="select-processor-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nmi">NMI</SelectItem>
                    <SelectItem value="usaepay">USAePay</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="authorize_net">Authorize.net</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Merchant ID</Label>
                <Input 
                  placeholder="Enter merchant ID"
                  value={merchantIdInput}
                  onChange={(e) => setMerchantIdInput(e.target.value)}
                  data-testid="input-merchant-id"
                />
              </div>

              {processorType === "nmi" && (
                <>
                  <div className="space-y-2">
                    <Label>NMI Security Key</Label>
                    <Input 
                      placeholder="Enter NMI security key"
                      type="password"
                      value={nmiSecurityKey}
                      onChange={(e) => setNmiSecurityKey(e.target.value)}
                      data-testid="input-nmi-security-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NMI Username (optional)</Label>
                    <Input 
                      placeholder="Enter NMI username"
                      value={nmiUsername}
                      onChange={(e) => setNmiUsername(e.target.value)}
                      data-testid="input-nmi-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NMI Password (optional)</Label>
                    <Input 
                      placeholder="Enter NMI password"
                      type="password"
                      value={nmiPassword}
                      onChange={(e) => setNmiPassword(e.target.value)}
                      data-testid="input-nmi-password"
                    />
                  </div>
                </>
              )}

              {processorType === "usaepay" && (
                <>
                  <div className="space-y-2">
                    <Label>USAePay Source Key</Label>
                    <Input 
                      placeholder="Enter source key"
                      type="password"
                      value={usaepaySourceKey}
                      onChange={(e) => setUsaepaySourceKey(e.target.value)}
                      data-testid="input-usaepay-source-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>USAePay PIN</Label>
                    <Input 
                      placeholder="Enter PIN"
                      type="password"
                      value={usaepayPin}
                      onChange={(e) => setUsaepayPin(e.target.value)}
                      data-testid="input-usaepay-pin"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <Switch 
                  checked={testMode} 
                  onCheckedChange={setTestMode}
                  data-testid="switch-test-mode"
                />
                <Label>Test Mode (sandbox)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleAddMerchant} 
                disabled={addMerchantMutation.isPending}
                data-testid="button-save-merchant"
              >
                {addMerchantMutation.isPending ? "Saving..." : "Save Merchant"}
              </Button>
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
                <p className="text-2xl font-bold">{merchants.length}</p>
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
                <p className="text-2xl font-bold">{activeMerchants.length}</p>
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
                <p className="text-2xl font-bold">--</p>
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
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : merchants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No merchant accounts configured</p>
              <p className="text-sm">Add a merchant to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {merchants.map((merchant) => (
                <div key={merchant.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-merchant-${merchant.id}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${merchant.isActive ? "bg-primary/10" : "bg-muted"}`}>
                      {merchant.processorType === "ach" || merchant.processorType === "check" ? (
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
                        {merchant.processorType?.toUpperCase() || "N/A"} - {merchant.merchantId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={merchant.isActive ?? false}
                        onCheckedChange={() => handleToggleActive(merchant)}
                        disabled={updateMerchantMutation.isPending}
                        data-testid={`switch-active-${merchant.id}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMerchantMutation.mutate(merchant.id)}
                        disabled={deleteMerchantMutation.isPending}
                        data-testid={`button-delete-${merchant.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
