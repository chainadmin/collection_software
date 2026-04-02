import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Bell,
  Shield,
  CreditCard,
  Users,
  FileText,
  Mail,
  Phone,
  Tag,
  Plus,
  Trash2,
  GripVertical,
  Settings2,
  Monitor,
  Download,
  Smartphone,
  Copy,
  ExternalLink,
  Zap,
  Key,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import type { ApiToken } from "@shared/schema";

const STATUS_COLORS = [
  { name: "blue", bg: "bg-blue-500", label: "Blue" },
  { name: "green", bg: "bg-green-500", label: "Green" },
  { name: "red", bg: "bg-red-500", label: "Red" },
  { name: "yellow", bg: "bg-yellow-500", label: "Yellow" },
  { name: "purple", bg: "bg-purple-500", label: "Purple" },
  { name: "orange", bg: "bg-orange-500", label: "Orange" },
  { name: "teal", bg: "bg-teal-500", label: "Teal" },
  { name: "pink", bg: "bg-pink-500", label: "Pink" },
  { name: "indigo", bg: "bg-indigo-500", label: "Indigo" },
  { name: "gray", bg: "bg-gray-500", label: "Gray" },
  { name: "emerald", bg: "bg-emerald-500", label: "Emerald" },
  { name: "slate", bg: "bg-slate-500", label: "Slate" },
];

function getColorClass(colorName: string): string {
  const color = STATUS_COLORS.find(c => c.name === colorName);
  return color?.bg || "bg-gray-500";
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState("");
  const [newTokenName, setNewTokenName] = useState("");
  const [accountStatuses, setAccountStatuses] = useState([
    { id: "1", name: "newbiz", label: "New Business", color: "blue", isSystem: true },
    { id: "2", name: "1st_message", label: "1st Message", color: "yellow", isSystem: true },
    { id: "3", name: "final", label: "Final", color: "red", isSystem: true },
    { id: "4", name: "promise", label: "Promise", color: "green", isSystem: true },
    { id: "5", name: "payments_pending", label: "Payments Pending", color: "purple", isSystem: true },
    { id: "6", name: "in_payment", label: "In Payment", color: "teal", isSystem: true },
    { id: "7", name: "paid", label: "Paid in Full", color: "emerald", isSystem: true },
    { id: "8", name: "closed", label: "Closed", color: "gray", isSystem: true },
  ]);

  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showTokenRevealDialog, setShowTokenRevealDialog] = useState(false);
  const [showSendInfoDialog, setShowSendInfoDialog] = useState(false);
  const [sendInfoEmail, setSendInfoEmail] = useState("");
  const [sendInfoPhone, setSendInfoPhone] = useState("");

  type MaskedApiToken = {
    id: string;
    name: string;
    tokenMasked: string;
    isActive: boolean | null;
    createdDate: string;
    lastUsedDate: string | null;
    expiresAt: string | null;
    organizationId: string | null;
  };

  const { data: apiTokens = [], isLoading: tokensLoading } = useQuery<MaskedApiToken[]>({
    queryKey: ["/api/settings/tokens"],
  });

  const createTokenMutation = useMutation({
    mutationFn: async (payload: { name: string; expiresAt?: string }) => {
      const res = await apiRequest("POST", "/api/settings/tokens", payload);
      return res.json() as Promise<{ id: string; name: string; token: string; createdDate: string; lastUsedDate: string | null; expiresAt: string | null }>;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/settings/tokens"] });
      setNewTokenName("");
      setRevealedToken(data.token);
      setShowTokenRevealDialog(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create API token.", variant: "destructive" });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/settings/tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tokens"] });
      toast({ title: "Token Revoked", description: "API token has been revoked." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke API token.", variant: "destructive" });
    },
  });

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      toast({ title: "Error", description: "Please enter a token name.", variant: "destructive" });
      return;
    }
    createTokenMutation.mutate({ name: newTokenName.trim() });
  };

  const getIntegrationInfoText = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `DebtFlow Pro API Integration Info\n\nBase URL: ${baseUrl}/api/v2\n\nAuthentication: Bearer Token\nHeader: Authorization: Bearer YOUR_TOKEN_HERE\n\nCollector Login:\n  POST ${baseUrl}/api/v2/login\n  Body: { "username": "...", "password": "..." }\n\nKey Endpoints:\n  GET  /api/v2/accounts?ssn=XXX\n  POST /api/v2/softphone/initiate\n  POST /api/v2/softphone/result\n  POST /api/v2/send_text\n  POST /api/v2/send_email_c2c\n  GET  /api/v2/softphone/queue\n\nContact your account manager for full API documentation.`;
  };

  const handleAddStatus = () => {
    if (!newStatus.trim()) {
      toast({ title: "Error", description: "Please enter a status name.", variant: "destructive" });
      return;
    }
    const id = String(Date.now());
    const name = newStatus.toLowerCase().replace(/\s+/g, "_");
    setAccountStatuses([...accountStatuses, { id, name, label: newStatus, color: "slate", isSystem: false }]);
    setNewStatus("");
    toast({ title: "Status Added", description: `"${newStatus}" has been added to account statuses.` });
  };

  const handleRemoveStatus = (id: string) => {
    const status = accountStatuses.find(s => s.id === id);
    if (status?.isSystem) {
      toast({ title: "Cannot Remove", description: "System statuses cannot be removed.", variant: "destructive" });
      return;
    }
    setAccountStatuses(accountStatuses.filter(s => s.id !== id));
    toast({ title: "Status Removed", description: "The status has been removed." });
  };

  const handleColorChange = (id: string, newColor: string) => {
    setAccountStatuses(accountStatuses.map(s => 
      s.id === id ? { ...s, color: newColor } : s
    ));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization
              </CardTitle>
              <CardDescription>General organization settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    placeholder="Enter organization name"
                    data-testid="input-org-name"
                  />
                </div>
                <div>
                  <Label htmlFor="orgPhone">Primary Phone</Label>
                  <Input
                    id="orgPhone"
                    placeholder="Enter phone number"
                    data-testid="input-org-phone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="orgAddress">Address</Label>
                <Input
                  id="orgAddress"
                  placeholder="Enter street address"
                  data-testid="input-org-address"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="orgCity">City</Label>
                  <Input id="orgCity" placeholder="City" />
                </div>
                <div>
                  <Label htmlFor="orgState">State</Label>
                  <Select>
                    <SelectTrigger id="orgState">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="orgZip">ZIP Code</Label>
                  <Input id="orgZip" placeholder="ZIP" />
                </div>
              </div>
              <div className="pt-2">
                <Button data-testid="button-save-org">Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive email alerts for important events</p>
                </div>
                <Switch defaultChecked data-testid="switch-email-notifications" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified when payments are processed</p>
                </div>
                <Switch defaultChecked data-testid="switch-payment-alerts" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Summary</p>
                  <p className="text-sm text-muted-foreground">Receive daily collection summary reports</p>
                </div>
                <Switch data-testid="switch-daily-summary" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dispute Notifications</p>
                  <p className="text-sm text-muted-foreground">Alerts when accounts are disputed</p>
                </div>
                <Switch defaultChecked data-testid="switch-dispute-notifications" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Processing
              </CardTitle>
              <CardDescription>Configure payment gateway settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="processorId">Processor ID</Label>
                <Input
                  id="processorId"
                  defaultValue="PROC-12345-ABCDE"
                  data-testid="input-processor-id"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="merchantId">Merchant ID</Label>
                  <Input
                    id="merchantId"
                    defaultValue="MID-67890"
                    data-testid="input-merchant-id"
                  />
                </div>
                <div>
                  <Label htmlFor="terminalId">Terminal ID</Label>
                  <Input
                    id="terminalId"
                    defaultValue="TID-11111"
                    data-testid="input-terminal-id"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-medium">ACH Processing</p>
                  <p className="text-sm text-muted-foreground">Enable ACH bank transfers</p>
                </div>
                <Switch defaultChecked data-testid="switch-ach-processing" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Card Processing</p>
                  <p className="text-sm text-muted-foreground">Enable credit/debit card payments</p>
                </div>
                <Switch defaultChecked data-testid="switch-card-processing" />
              </div>
              <div className="pt-2">
                <Button data-testid="button-save-payment">Save Payment Settings</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Account Statuses
              </CardTitle>
              <CardDescription>Manage collection account workflow statuses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter new status name..."
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStatus()}
                  data-testid="input-new-status"
                />
                <Button onClick={handleAddStatus} data-testid="button-add-status">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {accountStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`status-item-${status.name}`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`w-6 h-6 rounded-md ${getColorClass(status.color)} cursor-pointer border border-border hover:ring-2 hover:ring-ring hover:ring-offset-1`}
                            data-testid={`button-color-${status.name}`}
                            title="Click to change color"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="grid grid-cols-6 gap-2">
                            {STATUS_COLORS.map((color) => (
                              <button
                                key={color.name}
                                className={`w-6 h-6 rounded-md ${color.bg} cursor-pointer border-2 ${status.color === color.name ? 'border-foreground' : 'border-transparent'} hover:scale-110 transition-transform`}
                                onClick={() => handleColorChange(status.id, color.name)}
                                title={color.label}
                                data-testid={`color-option-${color.name}`}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Badge variant="outline">{status.label}</Badge>
                      {status.isSystem && (
                        <span className="text-xs text-muted-foreground">(System)</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStatus(status.id)}
                      disabled={status.isSystem}
                      data-testid={`button-remove-status-${status.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                System statuses are required for core workflow and cannot be removed. Custom statuses can be added for your specific collection process.
              </p>
              <div className="pt-2">
                <Button data-testid="button-save-statuses">Save Status Configuration</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Zap className="h-5 w-5" />
                External Integrations
              </CardTitle>
              <CardDescription>
                Connect SMS platforms, softphones, and dialers via the API v2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {authUser?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Admin:</span>
                  <span className="font-medium" data-testid="text-admin-email">{authUser.email}</span>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                <p className="text-sm font-medium">API Base URL</p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-xs bg-background p-2 rounded border truncate"
                    data-testid="text-api-base-url"
                  >
                    {typeof window !== "undefined" ? `${window.location.origin}/api/v2` : "/api/v2"}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/v2`);
                      toast({ title: "Copied!", description: "API base URL copied to clipboard." });
                    }}
                    data-testid="button-copy-api-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Authentication:</strong> Bearer Token</p>
                  <p><strong>Header:</strong> <code className="bg-background px-1 rounded">Authorization: Bearer YOUR_TOKEN</code></p>
                  <p><strong>Collector Login:</strong> <code className="bg-background px-1 rounded">POST /api/v2/login</code> with username + password</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Tokens
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Token name (e.g., SMS Platform, Dialer)"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateToken()}
                    data-testid="input-token-name"
                  />
                  <Button
                    onClick={handleCreateToken}
                    disabled={createTokenMutation.isPending}
                    data-testid="button-generate-token"
                  >
                    {createTokenMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Generate
                  </Button>
                </div>

                {tokensLoading ? (
                  <div className="text-sm text-muted-foreground">Loading tokens...</div>
                ) : apiTokens.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    No API tokens yet. Generate one to get started.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left p-2 text-xs font-medium text-muted-foreground">Name / Token</th>
                          <th className="text-left p-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Created</th>
                          <th className="text-left p-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Last Used</th>
                          <th className="text-left p-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Expires</th>
                          <th className="p-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiTokens.map((token, idx) => (
                          <tr
                            key={token.id}
                            className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                            data-testid={`token-item-${token.id}`}
                          >
                            <td className="p-2">
                              <p className="font-medium">{token.name}</p>
                              <code className="text-xs text-muted-foreground font-mono" data-testid={`text-token-masked-${token.id}`}>
                                {token.tokenMasked}
                              </code>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                              {new Date(token.createdDate).toLocaleDateString()}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                              {token.lastUsedDate ? new Date(token.lastUsedDate).toLocaleDateString() : "Never"}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                              {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "Never"}
                            </td>
                            <td className="p-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteTokenMutation.mutate(token.id)}
                                disabled={deleteTokenMutation.isPending}
                                data-testid={`button-revoke-token-${token.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Send Integration Info</p>
                  <p className="text-xs text-muted-foreground">Share API connection details with your integration partner</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSendInfoDialog(true)}
                  data-testid="button-send-integration-info"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Info
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* One-time token reveal dialog */}
          <Dialog open={showTokenRevealDialog} onOpenChange={(open) => {
            if (!open) { setShowTokenRevealDialog(false); setRevealedToken(null); }
          }}>
            <DialogContent className="max-w-lg" data-testid="dialog-token-reveal">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-green-600" />
                  API Token Created
                </DialogTitle>
                <DialogDescription>
                  Copy this token now — it will not be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-700 dark:text-yellow-400">
                  Save this token in a secure location. After closing this dialog, you will only see the first 10 characters.
                </div>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-xs bg-muted p-3 rounded border font-mono break-all select-all"
                    data-testid="text-revealed-token"
                  >
                    {revealedToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      if (revealedToken) {
                        navigator.clipboard.writeText(revealedToken);
                        toast({ title: "Copied!", description: "Token copied to clipboard." });
                      }
                    }}
                    data-testid="button-copy-revealed-token"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowTokenRevealDialog(false); setRevealedToken(null); }} data-testid="button-close-token-dialog">
                  I've saved the token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Integration Info dialog */}
          <Dialog open={showSendInfoDialog} onOpenChange={setShowSendInfoDialog}>
            <DialogContent className="max-w-lg" data-testid="dialog-send-info">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Integration Info
                </DialogTitle>
                <DialogDescription>
                  Share API connection details with your integration partner via email.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="send-info-email">Partner Email Address</Label>
                    <Input
                      id="send-info-email"
                      type="email"
                      placeholder="partner@smsplatform.com"
                      value={sendInfoEmail}
                      onChange={(e) => setSendInfoEmail(e.target.value)}
                      className="mt-1"
                      data-testid="input-send-info-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="send-info-phone">Partner Phone / SMS</Label>
                    <Input
                      id="send-info-phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={sendInfoPhone}
                      onChange={(e) => setSendInfoPhone(e.target.value)}
                      className="mt-1"
                      data-testid="input-send-info-phone"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Info that will be shared:</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-[160px] overflow-y-auto">
                    {getIntegrationInfoText()}
                  </pre>
                </div>
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(getIntegrationInfoText());
                    toast({ title: "Copied!", description: "Integration info copied to clipboard." });
                  }}
                  data-testid="button-copy-integration-info"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
                {sendInfoPhone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const body = encodeURIComponent(getIntegrationInfoText());
                      const phone = sendInfoPhone.replace(/\D/g, "");
                      window.open(`sms:${phone}?body=${body}`, "_blank");
                    }}
                    data-testid="button-open-sms"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Send via SMS
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const info = getIntegrationInfoText();
                    const subject = encodeURIComponent("DebtFlow Pro API Integration Info");
                    const body = encodeURIComponent(info);
                    const mailto = sendInfoEmail
                      ? `mailto:${sendInfoEmail}?subject=${subject}&body=${body}`
                      : `mailto:?subject=${subject}&body=${body}`;
                    window.open(mailto, "_blank");
                    setShowSendInfoDialog(false);
                  }}
                  data-testid="button-open-mailto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Open in Email Client
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Global Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Theme</Label>
                <Select value={theme} onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}>
                  <SelectTrigger data-testid="select-theme" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Monitor className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Desktop App</p>
                    <p className="text-sm text-muted-foreground">Install for faster access</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Install Debt Manager Pro as a desktop application for quick access from your taskbar.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-install-pwa"
                  onClick={() => {
                    const deferredPrompt = (window as any).__pwaInstallPrompt;
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      deferredPrompt.userChoice.then((choiceResult: any) => {
                        if (choiceResult.outcome === 'accepted') {
                          (window as any).__pwaInstallPrompt = null;
                        }
                      });
                    } else {
                      if (window.matchMedia('(display-mode: standalone)').matches) {
                        alert('App is already installed! Look for it in your applications.');
                      } else {
                        alert('To install: Click the install icon in your browser address bar, or use your browser menu to "Install App" or "Add to Home Screen".');
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install Desktop App
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" data-testid="button-change-password">
                Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-two-factor">
                Enable Two-Factor Auth
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-api-keys">
                Manage API Keys
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-audit-log">
                View Audit Log
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  FDCPA Compliant
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Fair Debt Collection Practices Act
                </p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  GLBA Compliant
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gramm-Leach-Bliley Act
                </p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  TCPA Compliant
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Telephone Consumer Protection Act
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>(800) 555-0199</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>support@collectmax.com</span>
              </div>
              <Button variant="outline" className="w-full mt-2" data-testid="button-contact-support">
                Contact Support
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install App
              </CardTitle>
              <CardDescription>
                Share this link with your team to install the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">App Download Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded border truncate" data-testid="text-app-url">
                    {typeof window !== 'undefined' ? window.location.origin : ''}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin);
                      toast({ title: "Copied!", description: "App link copied to clipboard" });
                    }}
                    data-testid="button-copy-app-link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Installation Instructions:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Desktop (Chrome/Edge):</strong> Click the install icon in the address bar or use browser menu → "Install App"</p>
                  <p><strong>iOS Safari:</strong> Tap Share → "Add to Home Screen"</p>
                  <p><strong>Android Chrome:</strong> Tap menu → "Add to Home Screen" or "Install App"</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(window.location.origin, '_blank')}
                data-testid="button-open-app"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open App in New Tab
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
