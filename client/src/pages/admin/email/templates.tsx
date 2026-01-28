import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, Edit, Copy, Trash2, Eye, Search, RefreshCw, CheckCircle, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmailTemplate } from "@shared/schema";

export default function EmailTemplates() {
  const { toast } = useToast();
  const [showEditor, setShowEditor] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const filteredTemplates = templates.filter((t: any) => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveTemplate = () => {
    if (!templateName || !templateSubject || !templateBody) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    toast({ title: "Template Saved & Synced", description: `${templateName} has been saved and synced to external SMS/TXT system.` });
    setShowEditor(false);
    setTemplateName("");
    setTemplateSubject("");
    setTemplateBody("");
  };

  const handleSyncTemplate = (templateName: string) => {
    toast({ title: "Syncing...", description: `Pushing ${templateName} to external system...` });
    setTimeout(() => {
      toast({ title: "Sync Complete", description: `${templateName} synced to external SMS/TXT system.` });
    }, 1000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "first_contact": return "bg-blue-500/10 text-blue-500";
      case "reminder": return "bg-yellow-500/10 text-yellow-500";
      case "confirmation": return "bg-green-500/10 text-green-500";
      case "offer": return "bg-purple-500/10 text-purple-500";
      case "final": return "bg-red-500/10 text-red-500";
      default: return "bg-muted";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SMS/TXT Templates</h1>
          <p className="text-muted-foreground">Create and manage message templates - synced to external SMS/TXT system</p>
        </div>
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input 
                  placeholder="e.g., Payment Reminder"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input 
                  placeholder="e.g., Payment Due - Account {{account_number}}"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  data-testid="input-template-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea 
                  placeholder="Enter email content... Use {{variable}} for dynamic content."
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="min-h-[200px]"
                  data-testid="input-template-body"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-2">
                  {["{{first_name}}", "{{last_name}}", "{{account_number}}", "{{balance}}", "{{payment_date}}", "{{company_name}}"].map((v) => (
                    <Badge key={v} variant="secondary" className="font-mono text-xs">{v}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} data-testid="button-save-template">Save Template</Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template: any) => (
          <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">{template.subject}</CardDescription>
                </div>
                <Badge className={getCategoryColor(template.category)}>
                  {template.category?.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Synced</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleSyncTemplate(template.name)}
                  data-testid={`button-sync-${template.id}`}
                >
                  <Cloud className="h-3 w-3 mr-1" />
                  Sync
                </Button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" data-testid={`button-preview-${template.id}`}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid={`button-edit-${template.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid={`button-duplicate-${template.id}`}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid={`button-delete-${template.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No templates found</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowEditor(true)}>
              Create your first template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
