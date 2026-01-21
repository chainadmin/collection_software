import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, Plus, Edit, Trash2, Percent, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FeeSchedule } from "@shared/schema";

export default function FeeSchedules() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeSchedule | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState("");
  const [minAmount, setMinAmount] = useState("");

  const { data: feeSchedules = [], isLoading } = useQuery<FeeSchedule[]>({
    queryKey: ["/api/fee-schedules"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<FeeSchedule>) => {
      return apiRequest("POST", "/api/fee-schedules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fee-schedules"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Fee Schedule Created", description: "New fee schedule has been created. Portfolios can now link to it." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create fee schedule.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FeeSchedule> }) => {
      return apiRequest("PATCH", `/api/fee-schedules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fee-schedules"] });
      setEditingFee(null);
      resetForm();
      toast({ title: "Fee Schedule Updated", description: "Fee schedule has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update fee schedule.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/fee-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fee-schedules"] });
      toast({ title: "Fee Schedule Deleted", description: "Fee schedule has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete fee schedule. It may be linked to portfolios.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPercentage("");
    setMinAmount("");
  };

  const handleEdit = (fee: FeeSchedule) => {
    setEditingFee(fee);
    setName(fee.name);
    setDescription(fee.description || "");
    setPercentage(fee.feePercentage ? String(fee.feePercentage / 100) : "");
    setMinAmount(fee.minimumFee ? String(fee.minimumFee) : "");
  };

  const handleSave = () => {
    if (!name || !percentage) {
      toast({ title: "Error", description: "Please enter a name and percentage.", variant: "destructive" });
      return;
    }

    const parsedPercentage = parseFloat(percentage);
    if (isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
      toast({ title: "Error", description: "Please enter a valid percentage (0-100).", variant: "destructive" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const data = {
      name,
      description: description || null,
      feeType: "contingency",
      feePercentage: Math.round(parsedPercentage * 100),
      minimumFee: minAmount ? parseInt(minAmount) : null,
      isActive: true,
      effectiveDate: today,
      createdDate: today,
    };

    if (editingFee) {
      updateMutation.mutate({ id: editingFee.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const handleToggleActive = (fee: FeeSchedule) => {
    updateMutation.mutate({ id: fee.id, data: { isActive: !fee.isActive } });
  };

  const activeFees = feeSchedules.filter(f => f.isActive);
  const avgPercentage = feeSchedules.length > 0 
    ? (feeSchedules.reduce((sum, f) => sum + (f.feePercentage || 0), 0) / feeSchedules.length / 100).toFixed(1)
    : "0";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fee Schedules</h1>
          <p className="text-muted-foreground">Create fee schedules that portfolios can link to for remittance calculations</p>
        </div>
        <Dialog open={showAddDialog || !!editingFee} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingFee(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-fee">
              <Plus className="h-4 w-4 mr-2" />
              Add Fee Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFee ? "Edit Fee Schedule" : "Create Fee Schedule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Fee Schedule Name *</Label>
                <Input 
                  placeholder="e.g., Standard Collection Fee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-fee-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-fee-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fee Percentage *</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      step="0.1"
                      placeholder="25"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
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
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    data-testid="input-min-amount"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEditingFee(null);
                resetForm();
              }}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={addMutation.isPending || updateMutation.isPending}
                data-testid="button-save-fee"
              >
                {(addMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Fee Schedule"}
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
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{feeSchedules.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeFees.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Percent className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgPercentage}%</p>
                <p className="text-sm text-muted-foreground">Avg Fee Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configured Fee Schedules</CardTitle>
          <CardDescription>Fee schedules are linked to portfolios for remittance calculations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : feeSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No fee schedules found. Create a fee schedule to get started.</p>
              <p className="text-sm mt-1">Portfolios can then link to these schedules for remittance calculations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feeSchedules.map((fee) => (
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
                        {fee.description || "No description"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-bold">{(fee.feePercentage || 0) / 100}%</p>
                      <p className="text-xs text-muted-foreground">
                        {fee.minimumFee && fee.minimumFee > 0 ? `Min: $${(fee.minimumFee / 100).toFixed(2)}` : "No minimum"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={fee.isActive ?? false} 
                        onCheckedChange={() => handleToggleActive(fee)}
                        data-testid={`switch-fee-active-${fee.id}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(fee)}
                        data-testid={`button-edit-fee-${fee.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(fee.id)}
                        data-testid={`button-delete-fee-${fee.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
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
