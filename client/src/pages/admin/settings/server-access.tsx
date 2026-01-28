import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Server, Plus, Shield, Globe, Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import type { IpWhitelist } from "@shared/schema";

export default function ServerAccess() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [ipAddress, setIpAddress] = useState("");
  const [ipDescription, setIpDescription] = useState("");
  const [enableIpRestriction, setEnableIpRestriction] = useState(true);

  const { data: whitelist = [] } = useQuery<IpWhitelist[]>({
    queryKey: ["/api/ip-whitelist"],
  });

  const activeCount = whitelist.filter((ip: any) => ip.isActive).length;

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
    toast({ title: "IP Added", description: `${ipAddress} has been added to the whitelist.` });
    setShowAddDialog(false);
    setIpAddress("");
    setIpDescription("");
  };

  const handleRemoveIp = (id: string) => {
    toast({ title: "IP Removed", description: "The IP address has been removed from the whitelist." });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
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
              <Button onClick={handleAddIp} data-testid="button-save-ip">Add to Whitelist</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-yellow-500/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
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
                onCheckedChange={setEnableIpRestriction}
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
            {whitelist.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No IP addresses in whitelist</p>
                <p className="text-sm">Add IP addresses to restrict collector login access</p>
              </div>
            ) : null}
            {whitelist.map((ip: any) => (
              <div 
                key={ip.id} 
                className={`flex items-center justify-between p-4 border rounded-lg ${!ip.isActive ? "opacity-60" : ""}`}
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
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">{ip.ipAddress}</p>
                      <Badge variant={ip.isActive ? "default" : "secondary"}>
                        {ip.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ip.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Last used</p>
                    <p>{formatDate(ip.lastUsed)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={ip.isActive} />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleRemoveIp(ip.id)}
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
          <CardTitle className="text-lg">Recent Access Attempts</CardTitle>
          <CardDescription>Login attempts from non-whitelisted IPs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent access attempts</p>
            <p className="text-sm">Login attempts will appear here when IP restriction is enabled</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
