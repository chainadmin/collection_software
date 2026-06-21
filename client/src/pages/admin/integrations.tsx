import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Zap,
  Mail,
  Copy,
  Key,
  Plus,
  RefreshCw,
  Trash2,
  Send,
  Phone,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { apiRequest } from "@/lib/queryClient";

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

type MaskedCampaignIntegration = {
  id: string;
  name: string;
  type: string;
  apiBaseUrl: string;
  isActive: boolean | null;
  createdDate: string;
  hasApiKey: boolean;
  organizationId: string;
};

function CampaignIntegrationsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: integrations = [], isLoading } = useQuery<MaskedCampaignIntegration[]>({
    queryKey: ["/api/campaign-integrations"],
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setApiBaseUrl("");
    setApiKey("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name, apiBaseUrl };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      if (editingId) {
        return apiRequest("PATCH", `/api/campaign-integrations/${editingId}`, payload);
      }
      return apiRequest("POST", "/api/campaign-integrations", { ...payload, apiKey: apiKey.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-integrations"] });
      toast({ title: "Saved", description: "Chain integration saved." });
      setShowForm(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save integration.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/campaign-integrations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-integrations"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update integration.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/campaign-integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-integrations"] });
      toast({ title: "Removed", description: "Chain integration removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove integration.", variant: "destructive" });
    },
  });

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (i: MaskedCampaignIntegration) => {
    setEditingId(i.id);
    setName(i.name);
    setApiBaseUrl(i.apiBaseUrl);
    setApiKey("");
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim() || !apiBaseUrl.trim()) {
      toast({ title: "Error", description: "Name and provider base URL are required.", variant: "destructive" });
      return;
    }
    if (!editingId && !apiKey.trim()) {
      toast({ title: "Error", description: "API key is required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              DebtFlow Pro → Chain (outbound)
            </CardTitle>
            <CardDescription>
              Store your Chain provider's URL and External API Key so DebtFlow Pro can send your email and text campaigns through Chain.
            </CardDescription>
          </div>
          <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-integration">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Integration" : "Add Chain Integration"}</DialogTitle>
                <DialogDescription>
                  Enter your Chain provider details. The API key is stored securely and never shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g., Chain SMS"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-integration-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provider Base URL</Label>
                  <Input
                    placeholder="https://api.chainprovider.com"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    data-testid="input-integration-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key {editingId && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}</Label>
                  <Input
                    type="password"
                    placeholder={editingId ? "••••••••" : "Enter provider API key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-integration-key"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-integration">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Integration"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : integrations.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No outbound Chain provider yet. Add one to send your template campaigns through Chain.
          </div>
        ) : (
          <div className="space-y-2">
            {integrations.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                data-testid={`integration-item-${i.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{i.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{i.apiBaseUrl}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!i.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: i.id, isActive: checked })}
                      data-testid={`switch-active-${i.id}`}
                    />
                    <span className="text-xs text-muted-foreground">{i.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(i)} data-testid={`button-edit-integration-${i.id}`}>
                    <Key className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-integration-${i.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this integration?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the <strong>{i.name}</strong> Chain integration. Campaigns can no longer be sent through it. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid={`button-cancel-delete-integration-${i.id}`}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(i.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid={`button-confirm-delete-integration-${i.id}`}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const companyCode = organization?.slug || "";

  const [newTokenName, setNewTokenName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showTokenRevealDialog, setShowTokenRevealDialog] = useState(false);
  const [showSendInfoDialog, setShowSendInfoDialog] = useState(false);
  const [sendInfoEmail, setSendInfoEmail] = useState("");
  const [sendInfoPhone, setSendInfoPhone] = useState("");

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
    return `DebtFlow Pro API Integration Info\n\nAPI URL: ${baseUrl}/api/v2\n\nCompany-level login (use in Chain):\n  Username: ${companyCode || "<your company code>"}\n  Password: <the API key you generated>\n\nAuthentication: Bearer Token\nHeader: Authorization: Bearer YOUR_TOKEN_HERE\n\nLogin endpoint:\n  POST ${baseUrl}/api/v2/login\n  Body: { "username": "${companyCode || "<company code>"}", "password": "<API key>" }\n\nKey Endpoints:\n  GET  /api/v2/accounts?ssn=XXX\n  POST /api/v2/softphone/initiate\n  POST /api/v2/softphone/result\n  POST /api/v2/send_text\n  POST /api/v2/send_email_c2c\n  GET  /api/v2/softphone/queue\n\nContact your account manager for full API documentation.`;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Connect Chain</h1>
        <p className="text-sm text-muted-foreground">
          Set up the two-way connection between DebtFlow Pro and Chain (and other SMS/dialer platforms).
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-2 text-sm">
            <p className="font-medium">How the connection works</p>
            <p className="text-muted-foreground">
              <strong>Chain → DebtFlow Pro:</strong> Chain reads your accounts and posts payments and notes back to DebtFlow Pro. Set this up below using your company code and an API key.
            </p>
            <p className="text-muted-foreground">
              <strong>DebtFlow Pro → Chain:</strong> DebtFlow Pro sends your email and text campaigns out through Chain. Set this up in the outbound section.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Chain → DebtFlow Pro (inbound)
            </CardTitle>
            <CardDescription>
              Give Chain these three details so it can connect to your DebtFlow Pro account. No collector login is needed.
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

            <div className="p-4 rounded-lg bg-muted/50 border space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">1. API URL</p>
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
                      toast({ title: "Copied!", description: "API URL copied to clipboard." });
                    }}
                    data-testid="button-copy-api-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">2. Username (your company code)</p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-xs bg-background p-2 rounded border truncate"
                    data-testid="text-company-code"
                  >
                    {companyCode || "Loading…"}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!companyCode}
                    onClick={() => {
                      navigator.clipboard.writeText(companyCode);
                      toast({ title: "Copied!", description: "Company code copied to clipboard." });
                    }}
                    data-testid="button-copy-company-code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">3. Password (an API key)</p>
                <p className="text-xs text-muted-foreground">
                  Generate an API key below and paste it into Chain's password field. The key is shown only once.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled={deleteTokenMutation.isPending}
                                  data-testid={`button-revoke-token-${token.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke this API token?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently revoke the <strong>{token.name}</strong> token. Any integration using it will stop working immediately. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid={`button-cancel-revoke-token-${token.id}`}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTokenMutation.mutate(token.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`button-confirm-revoke-token-${token.id}`}
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        <CampaignIntegrationsCard />

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
    </div>
  );
}
