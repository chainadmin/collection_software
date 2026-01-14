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
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function Settings() {
  const { theme, setTheme } = useTheme();

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
        </div>
      </div>
    </div>
  );
}
