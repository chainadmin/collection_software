import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Send,
  Mail,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EmailTemplate, Debtor, DebtorContact } from "@shared/schema";

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

const MERGE_VARS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{account_number}}",
  "{{balance}}",
  "{{payment_date}}",
  "{{company_name}}",
];

const blankForm = { name: "", subject: "", body: "", templateType: "email" };

export default function EmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [searchTerm, setSearchTerm] = useState("");

  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<EmailTemplate | null>(null);

  const [sendTemplate, setSendTemplate] = useState<EmailTemplate | null>(null);
  const [sendIntegrationId, setSendIntegrationId] = useState<string>("");
  const [sendCampaignName, setSendCampaignName] = useState("");
  const [selectedDebtorIds, setSelectedDebtorIds] = useState<Set<string>>(new Set());
  const [accountSearch, setAccountSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const { data: integrations = [] } = useQuery<MaskedCampaignIntegration[]>({
    queryKey: ["/api/campaign-integrations"],
  });

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetEditor = () => {
    setForm(blankForm);
    setEditingId(null);
  };

  const openCreate = () => {
    resetEditor();
    setShowEditor(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      subject: t.subject || "",
      body: t.body,
      templateType: t.templateType,
    });
    setShowEditor(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        subject: form.templateType === "email" ? form.subject : "",
        body: form.body,
        templateType: form.templateType,
      };
      if (editingId) {
        return apiRequest("PATCH", `/api/email-templates/${editingId}`, payload);
      }
      return apiRequest("POST", "/api/email-templates", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Saved", description: `Template "${form.name}" has been saved.` });
      setShowEditor(false);
      resetEditor();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/email-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Deleted", description: "Template has been deleted." });
      setDeleteTemplate(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast({ title: "Error", description: "Name and body are required.", variant: "destructive" });
      return;
    }
    if (form.templateType === "email" && !form.subject.trim()) {
      toast({ title: "Error", description: "Subject is required for email templates.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const insertVariable = (v: string) => {
    setForm((f) => ({ ...f, body: `${f.body}${v}` }));
  };

  // ---- Send campaign ----
  const { data: debtors = [] } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
    enabled: !!sendTemplate,
  });

  const requiredIntegrationType = sendTemplate?.templateType === "email" ? "email" : "sms";
  const compatibleIntegrations = integrations.filter(
    (i) => i.isActive && i.type === requiredIntegrationType
  );
  const sendIntegration = integrations.find((i) => i.id === sendIntegrationId);

  const filteredDebtors = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return debtors
      .filter((d) => {
        if (!q) return true;
        return (
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
          (d.fileNumber || "").toLowerCase().includes(q) ||
          d.accountNumber.toLowerCase().includes(q) ||
          (d.email || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [debtors, accountSearch]);

  const openSend = (t: EmailTemplate) => {
    setSendTemplate(t);
    setSendCampaignName(t.name);
    setSelectedDebtorIds(new Set());
    setAccountSearch("");
    const want = t.templateType === "email" ? "email" : "sms";
    const match = integrations.find((i) => i.isActive && i.type === want);
    setSendIntegrationId(match?.id || "");
  };

  const toggleDebtor = (id: string) => {
    setSelectedDebtorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const integration = integrations.find((i) => i.id === sendIntegrationId);
      if (!integration) throw new Error("No integration selected");
      const wantType = integration.type === "email" ? "email" : "phone";

      const selected = debtors.filter((d) => selectedDebtorIds.has(d.id));
      const accounts: Array<{ debtorId: string; contactValue: string; contactType: string }> = [];

      for (const debtor of selected) {
        let contactValue = "";
        if (wantType === "email") {
          contactValue = debtor.email || "";
        }
        if (!contactValue) {
          // Look up contacts for a matching phone/email
          const res = await apiRequest("GET", `/api/debtors/${debtor.id}/contacts`);
          const contacts = (await res.json()) as DebtorContact[];
          const match =
            contacts.find((c) => c.type === wantType && c.isPrimary) ||
            contacts.find((c) => c.type === wantType);
          contactValue = match?.value || "";
        }
        if (contactValue) {
          accounts.push({ debtorId: debtor.id, contactValue, contactType: wantType });
        }
      }

      if (accounts.length === 0) {
        throw new Error(`No selected accounts have a usable ${wantType}.`);
      }

      return apiRequest("POST", "/api/campaigns/send", {
        integrationId: sendIntegrationId,
        campaignName: sendCampaignName,
        accounts,
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-logs"] });
      toast({
        title: "Campaign sent",
        description: `Sent to accounts. Campaign ID: ${data.campaignLogId?.slice(0, 8)}…`,
      });
      setSendTemplate(null);
    },
    onError: (e: any) => {
      toast({
        title: "Send failed",
        description: e?.message || "Failed to send campaign.",
        variant: "destructive",
      });
    },
  });

  const typeBadge = (type: string) =>
    type === "email" ? (
      <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" /> Email</Badge>
    ) : (
      <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" /> Text</Badge>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Message Templates</h1>
          <p className="text-muted-foreground">
            Create email and text-message templates and send them to accounts through your Chain integration
          </p>
        </div>
        <Dialog
          open={showEditor}
          onOpenChange={(open) => {
            setShowEditor(open);
            if (!open) resetEditor();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Template" : "Create Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    placeholder="e.g., Payment Reminder"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    data-testid="input-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={form.templateType}
                    onValueChange={(v) => setForm((f) => ({ ...f, templateType: v }))}
                  >
                    <SelectTrigger data-testid="select-template-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="text">Text Message (SMS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.templateType === "email" && (
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="e.g., Payment Due - Account {{account_number}}"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    data-testid="input-template-subject"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{form.templateType === "email" ? "Email Body" : "Message Text"}</Label>
                <Textarea
                  placeholder="Enter content... Use {{variable}} for dynamic content."
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  className="min-h-[180px]"
                  data-testid="input-template-body"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2">Click to insert a variable:</p>
                <div className="flex flex-wrap gap-2">
                  {MERGE_VARS.map((v) => (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="font-mono text-xs cursor-pointer hover-elevate"
                      onClick={() => insertVariable(v)}
                      data-testid={`badge-var-${v.replace(/[{}]/g, "")}`}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-template">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.templateType === "email" && (
                      <CardDescription className="text-xs mt-1 truncate">{template.subject}</CardDescription>
                    )}
                  </div>
                  {typeBadge(template.templateType)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{template.body}</p>
                <div className="flex items-center justify-between">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openSend(template)}
                    data-testid={`button-send-${template.id}`}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setPreviewTemplate(template)} data-testid={`button-preview-${template.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(template)} data-testid={`button-edit-${template.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTemplate(template)} data-testid={`button-delete-${template.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No templates found</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Create your first template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-preview">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            {previewTemplate?.templateType === "email" && (
              <DialogDescription>Subject: {previewTemplate?.subject}</DialogDescription>
            )}
          </DialogHeader>
          <div className="py-2">
            <pre className="text-sm whitespace-pre-wrap break-words bg-muted p-3 rounded-lg max-h-[400px] overflow-y-auto">
              {previewTemplate?.body}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(o) => !o && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTemplate?.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send campaign dialog */}
      <Dialog open={!!sendTemplate} onOpenChange={(o) => !o && setSendTemplate(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-send-campaign">
          <DialogHeader>
            <DialogTitle>Send "{sendTemplate?.name}"</DialogTitle>
            <DialogDescription>
              Send this template to selected accounts through your Chain integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {compatibleIntegrations.length === 0 ? (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-700 dark:text-yellow-400">
                No active {requiredIntegrationType === "email" ? "email" : "SMS"} integration configured. Add one under Text &amp; Email Integration first.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      value={sendCampaignName}
                      onChange={(e) => setSendCampaignName(e.target.value)}
                      data-testid="input-campaign-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Integration</Label>
                    <Select value={sendIntegrationId} onValueChange={setSendIntegrationId}>
                      <SelectTrigger data-testid="select-send-integration">
                        <SelectValue placeholder="Choose integration" />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleIntegrations.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Accounts will be contacted by{" "}
                  <strong>{sendIntegration?.type === "email" ? "email address" : "phone number"}</strong>.
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-account-search"
                  />
                </div>

                <div className="border rounded-lg max-h-[260px] overflow-y-auto divide-y">
                  {filteredDebtors.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 p-2 cursor-pointer hover-elevate"
                      data-testid={`row-account-${d.id}`}
                    >
                      <Checkbox
                        checked={selectedDebtorIds.has(d.id)}
                        onCheckedChange={() => toggleDebtor(d.id)}
                        data-testid={`checkbox-account-${d.id}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {d.firstName} {d.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.fileNumber || d.accountNumber}
                          {d.email ? ` · ${d.email}` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                  {filteredDebtors.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">No accounts found</div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-selected-count">
                  {selectedDebtorIds.size} account(s) selected
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTemplate(null)}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={
                sendMutation.isPending ||
                compatibleIntegrations.length === 0 ||
                !sendIntegrationId ||
                selectedDebtorIds.size === 0 ||
                !sendCampaignName.trim()
              }
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Send Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
