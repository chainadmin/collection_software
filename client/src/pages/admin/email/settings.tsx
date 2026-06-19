import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OrgEmailSettings {
  notificationEmail: string;
  isActive: boolean;
}

export default function EmailSettings() {
  const { toast } = useToast();
  const [notificationEmail, setNotificationEmail] = useState("");
  const [isActive, setIsActive] = useState(false);

  const { data, isLoading } = useQuery<OrgEmailSettings>({
    queryKey: ["/api/email-settings"],
  });

  useEffect(() => {
    if (data) {
      setNotificationEmail(data.notificationEmail || "");
      setIsActive(data.isActive ?? false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: OrgEmailSettings) => {
      const res = await apiRequest("POST", "/api/email-settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({ title: "Saved", description: "Email settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save email settings.", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Email Settings</h1>
        <p className="text-muted-foreground">Choose where your company's email notifications and reports are sent.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notification Recipients
              </CardTitle>
              <CardDescription>
                Emails are delivered securely through the platform. You only choose the recipient addresses.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="email-active">Enable Email Notifications</Label>
              <Switch
                id="email-active"
                data-testid="switch-email-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading email settings...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="notification-email">Recipient Email Address(es)</Label>
                <Textarea
                  id="notification-email"
                  data-testid="input-notification-email"
                  placeholder="alerts@yourcompany.com, manager@yourcompany.com"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple addresses with commas. These addresses receive your company's
                  notifications and reports.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  data-testid="button-save-settings"
                  onClick={() => saveMutation.mutate({ notificationEmail, isActive })}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
