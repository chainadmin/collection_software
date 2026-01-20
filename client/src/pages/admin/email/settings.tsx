import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Mail, Shield, Clock, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmailSettings() {
  const { toast } = useToast();
  const [smtpHost, setSmtpHost] = useState("smtp.example.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("noreply@debtflow.com");
  const [senderName, setSenderName] = useState("DebtFlow Pro");
  const [replyTo, setReplyTo] = useState("collections@debtflow.com");
  const [enableTracking, setEnableTracking] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("500");
  const [enableScheduling, setEnableScheduling] = useState(true);

  const handleSave = () => {
    toast({ title: "Settings Saved", description: "Email settings have been updated successfully." });
  };

  const handleTestEmail = () => {
    toast({ title: "Test Email Sent", description: "A test email has been sent to your address." });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email Settings</h1>
        <p className="text-muted-foreground">Configure email delivery and tracking</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              SMTP Configuration
            </CardTitle>
            <CardDescription>Configure your email server settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input 
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  data-testid="input-smtp-host"
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input 
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  data-testid="input-smtp-port"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SMTP Username</Label>
              <Input 
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                data-testid="input-smtp-user"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input 
                type="password"
                placeholder="Enter password"
                data-testid="input-smtp-password"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleTestEmail} data-testid="button-test-email">
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </Button>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Connected
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Sender Settings
            </CardTitle>
            <CardDescription>Configure how emails appear to recipients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Sender Name</Label>
              <Input 
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                data-testid="input-sender-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Reply-To Address</Label>
              <Input 
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                data-testid="input-reply-to"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Signature</Label>
              <Select defaultValue="standard">
                <SelectTrigger data-testid="select-signature">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Company Signature</SelectItem>
                  <SelectItem value="minimal">Minimal Signature</SelectItem>
                  <SelectItem value="custom">Custom Signature</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Compliance
            </CardTitle>
            <CardDescription>Email tracking and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Open Tracking</Label>
                <p className="text-xs text-muted-foreground">Track when emails are opened</p>
              </div>
              <Switch 
                checked={enableTracking}
                onCheckedChange={setEnableTracking}
                data-testid="switch-tracking"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Click Tracking</Label>
                <p className="text-xs text-muted-foreground">Track link clicks in emails</p>
              </div>
              <Switch defaultChecked data-testid="switch-click-tracking" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Include Unsubscribe Link</Label>
                <p className="text-xs text-muted-foreground">Required for compliance</p>
              </div>
              <Switch defaultChecked disabled data-testid="switch-unsubscribe" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rate Limits & Scheduling
            </CardTitle>
            <CardDescription>Control email sending frequency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Daily Send Limit</Label>
              <Input 
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                data-testid="input-daily-limit"
              />
              <p className="text-xs text-muted-foreground">Maximum emails per day (0 = unlimited)</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Scheduled Sending</Label>
                <p className="text-xs text-muted-foreground">Allow scheduling emails for later</p>
              </div>
              <Switch 
                checked={enableScheduling}
                onCheckedChange={setEnableScheduling}
                data-testid="switch-scheduling"
              />
            </div>
            <div className="space-y-2">
              <Label>Quiet Hours</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select defaultValue="21">
                  <SelectTrigger data-testid="select-quiet-start">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select defaultValue="8">
                  <SelectTrigger data-testid="select-quiet-end">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">No emails sent during these hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-settings">
          Save Settings
        </Button>
      </div>
    </div>
  );
}
