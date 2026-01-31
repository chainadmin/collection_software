import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Shield, Globe, Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IpWhitelist } from "@shared/schema";

export default function ServerAccess() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [ipAddress, setIpAddress] = useState("");
  const [ipDescription, setIpDescription] = useState("");

  const { data: whitelist = [], isLoading: whitelistLoading } = useQuery<IpWhitelist[]>({
    queryKey: ["/api/ip-whitelist"],
  });

  const { data: ipRestrictionStatus } = useQuery<{ ipRestrictionEnabled: boolean }>({
    queryKey: ["/api/organization/ip-restriction"],
  });

  const [enableIpRestriction, setEnableIpRestriction] = useState(false);

  useEffect(() => {
    if (ipRestrictionStatus) {
      setEnableIpRestriction(ipRestrictionStatus.ipRestrictionEnabled);
    }
  }, [ipRestrictionStatus]);

  const activeCount = whitelist.filter((ip) => ip.isActive).length;

  const addIpMutation = useMutation({
    mutationFn: async (data: { ipAddress: string; description: string }) => {
      return apiRequest("POST", "/api/ip-whitelist", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ip-whitelist"] });
      toast({ title: "IP Added", description: `${ipAddress} has been added to the whitelist.` });
      setShowAddDialog(false);
      setIpAddress("");
      setIpDescription("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add IP address.", variant: "destructive" });
    },
  });

  const updateIpMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/ip-whitelist/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ip-whitelist"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update IP address.", variant: "destructive" });
    },
  });

  const deleteIpMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ip-whitelist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ip-whitelist"] });
      toast({ title: "IP Removed", description: "The IP address has been removed from the whitelist." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove IP address.", variant: "destructive" });
    },
  });

  const toggleRestrictionMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/organization/ip-restriction", { enabled });
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/ip-restriction"] });
      toast({ 
        title: enabled ? "IP Restriction Enabled" : "IP Restriction Disabled", 
        description: enabled 
          ? "Collectors can only login from whitelisted IPs." 
          : "Collectors can login from any IP." 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update IP restriction setting.", variant: "destructive" });
      setEnableIpRestriction(!enableIpRestriction);
    },
  });

  const handleAddIp = () => {
    if (!ipAddress) {
      toast({ title: "Error", description: "Please enter an IP address.", variant: "destructive" });
      return;
    }
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(ipAddress)) {
      toast({ title: "Error", description: "Please enter a valid IP address or CIDR range.", variant: "destructive" });
      return;
    }
    addIpMutation.mutate({ ipAddress, description: ipDescription });
  };

  const handleToggleRestriction = (checked: boolean) => {
    setEnableIpRestriction(checked);
    toggleRestrictionMutation.mutate(checked);
  };

  const handleToggleIpActive = (id: string, isActive: boolean) => {
    updateIpMutation.mutate({ id, isActive: !isActive });
  };

  const handleRemoveIp = (id: string) => {
    deleteIpMutation.mutate(id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Server Access Control</h1>
          <p className="text-muted-foreground">Manage IP whitelist for collector login</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-ip">
              <Plus className="h-4 w-4 mr-2" />
              Add IP Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add IP to Whitelist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>IP Address or CIDR Range</Label>
                <Input 
                  placeholder="e.g., 192.168.1.100 or 10.0.0.0/24"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  data-testid="input-ip-address"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a single IP or CIDR notation for a range
                </p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="e.g., Main Office, Remote Worker Name"
                  value={ipDescription}
                  onChange={(e) => setIpDescription(e.target.value)}
                  data-testid="input-ip-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleAddIp} 
                disabled={addIpMutation.isPending}
                data-testid="button-save-ip"
              >
                {addIpMutation.isPending ? "Adding..." : "Add to Whitelist"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-yellow-500/50 dark:border-yellow-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Shield className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="font-medium">IP Restriction</p>
                <p className="text-sm text-muted-foreground">
                  {enableIpRestriction 
                    ? "Collectors can only login from whitelisted IPs" 
                    : "IP restriction is disabled - collectors can login from any IP"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={enableIpRestriction ? "default" : "secondary"}>
                {enableIpRestriction ? "Enabled" : "Disabled"}
              </Badge>
              <Switch 
                checked={enableIpRestriction}
                onCheckedChange={handleToggleRestriction}
                disabled={toggleRestrictionMutation.isPending}
                data-testid="switch-ip-restriction"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{whitelist.length}</p>
                <p className="text-sm text-muted-foreground">Total IPs</p>
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
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Blocked Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IP Whitelist</CardTitle>
          <CardDescription>Authorized IP addresses for collector access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {whitelistLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading...</p>
              </div>
            ) : whitelist.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No IP addresses in whitelist</p>
                <p className="text-sm">Add IP addresses to restrict collector login access</p>
              </div>
            ) : null}
            {whitelist.map((ip) => (
              <div 
                key={ip.id} 
                className={`flex items-center justify-between p-4 border rounded-lg flex-wrap gap-4 ${!ip.isActive ? "opacity-60" : ""}`}
                data-testid={`row-ip-${ip.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${ip.isActive ? "bg-green-500/10" : "bg-muted"}`}>
                    {ip.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-medium">{ip.ipAddress}</p>
                      <Badge variant={ip.isActive ? "default" : "secondary"}>
                        {ip.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ip.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Added</p>
                    <p>{formatDate(ip.createdDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={ip.isActive ?? false}
                      onCheckedChange={() => handleToggleIpActive(ip.id, ip.isActive ?? false)}
                      data-testid={`switch-ip-${ip.id}`}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleRemoveIp(ip.id)}
                      data-testid={`button-delete-ip-${ip.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
          <CardDescription>Understanding IP-based access control</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Organization-Specific</p>
                <p className="text-muted-foreground">Each organization has its own IP whitelist. Your settings don't affect other organizations.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">When Enabled</p>
                <p className="text-muted-foreground">Collectors can only login from IP addresses in this whitelist. Blocked attempts show an access denied error.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">CIDR Support</p>
                <p className="text-muted-foreground">You can add entire IP ranges using CIDR notation (e.g., 192.168.1.0/24 for a /24 subnet).</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
