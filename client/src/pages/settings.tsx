import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  const [newStatus, setNewStatus] = useState("");
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
                    defaultValue="ABC Collections LLC"
                    data-testid="input-org-name"
                  />
                </div>
                <div>
                  <Label htmlFor="orgPhone">Primary Phone</Label>
                  <Input
                    id="orgPhone"
                    defaultValue="(555) 123-4567"
                    data-testid="input-org-phone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="orgAddress">Address</Label>
                <Input
                  id="orgAddress"
                  defaultValue="123 Collection Ave, Suite 100"
                  data-testid="input-org-address"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="orgCity">City</Label>
                  <Input id="orgCity" defaultValue="New York" />
                </div>
                <div>
                  <Label htmlFor="orgState">State</Label>
                  <Select defaultValue="NY">
                    <SelectTrigger id="orgState">
                      <SelectValue />
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
                  <Input id="orgZip" defaultValue="10001" />
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Appearance</CardTitle>
            </CardHeader>
            <CardContent>
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
                <Settings2 className="h-5 w-5" />
                Global Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  Install Debt Manager Pro as a desktop application for a better experience with offline support and quick access from your taskbar.
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
                      // Check if already installed or browser doesn't support
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
        </div>
      </div>
    </div>
  );
}
