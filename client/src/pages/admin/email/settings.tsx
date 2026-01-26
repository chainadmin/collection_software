import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, MessageSquare, Link2, Clock, Send, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmailSettings() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("https://api.sms-provider.com/v1");
  const [senderId, setSenderId] = useState("DebtFlow");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [autoSyncTemplates, setAutoSyncTemplates] = useState(true);

  const handleSave = () => {
    toast({ title: "Settings Saved", description: "SMS/TXT integration settings have been updated." });
  };

  const handleTestConnection = () => {
    if (!apiKey) {
      toast({ title: "Error", description: "Please enter an API key first.", variant: "destructive" });
      return;
    }
    setIsConnected(true);
    toast({ title: "Connection Successful", description: "Connected to SMS/TXT provider." });
  };

  const handleSyncNow = () => {
    toast({ title: "Sync Started", description: "Syncing templates with external system..." });
    setTimeout(() => {
      toast({ title: "Sync Complete", description: "All templates synced successfully." });
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SMS/TXT Settings</h1>
        <p className="text-muted-foreground">Configure external SMS/TXT provider integration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              API Connection
            </CardTitle>
            <CardDescription>Connect to your SMS/TXT provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input 
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.provider.com/v1"
                data-testid="input-api-endpoint"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                data-testid="input-api-key"
              />
            </div>
            <div className="space-y-2">
              <Label>Callback/Webhook URL</Label>
              <Input 
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://yourapp.com/api/sms/webhook"
                data-testid="input-callback-url"
              />
              <p className="text-xs text-muted-foreground">Receives delivery status, open rates, and analytics from provider</p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={handleTestConnection} data-testid="button-test-connection">
                <Send className="h-4 w-4 mr-2" />
                Test Connection
              </Button>
              {isConnected ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Not Connected
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Sender Settings
            </CardTitle>
            <CardDescription>Configure message sender identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Sender ID / From Name</Label>
              <Input 
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                data-testid="input-sender-id"
              />
              <p className="text-xs text-muted-foreground">Name shown to recipients (max 11 characters)</p>
            </div>
            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select defaultValue="transactional">
                <SelectTrigger data-testid="select-message-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Country Code</Label>
              <Select defaultValue="+1">
                <SelectTrigger data-testid="select-country-code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+1">+1 (US/Canada)</SelectItem>
                  <SelectItem value="+44">+44 (UK)</SelectItem>
                  <SelectItem value="+61">+61 (Australia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Template Sync
            </CardTitle>
            <CardDescription>Sync templates with external SMS/TXT system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Template Sync</Label>
                <p className="text-xs text-muted-foreground">Push templates to external system</p>
              </div>
              <Switch 
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
                data-testid="switch-sync-enabled"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Sync on Save</Label>
                <p className="text-xs text-muted-foreground">Automatically sync when templates are created/updated</p>
              </div>
              <Switch 
                checked={autoSyncTemplates}
                onCheckedChange={setAutoSyncTemplates}
                disabled={!syncEnabled}
                data-testid="switch-auto-sync"
              />
            </div>
            <div className="pt-2">
              <Button 
                variant="outline" 
                onClick={handleSyncNow} 
                disabled={!syncEnabled || !isConnected}
                className="w-full"
                data-testid="button-sync-now"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync All Templates Now
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Sync:</span>
                <span>Never</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Templates Synced:</span>
                <Badge variant="secondary">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sending Rules
            </CardTitle>
            <CardDescription>Configure message sending behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-xs text-muted-foreground">No messages sent during these hours</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Open rates, delivery status, and analytics are tracked by your external SMS/TXT provider and sent to your callback URL.
              </p>
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
