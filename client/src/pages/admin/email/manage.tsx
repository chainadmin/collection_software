import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Send, Search, Mail, Clock, CheckCircle, AlertCircle, Users, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { CampaignLog, Collector } from "@shared/schema";

const statusBadge: Record<string, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  partial: { label: "Partially sent", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  pending: { label: "Sending...", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

function isToday(dateString: string): boolean {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function EmailManage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs = [], isLoading } = useQuery<CampaignLog[]>({
    queryKey: ["/api/campaign-logs"],
  });

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const getSenderName = (collectorId: string) => {
    const collector = collectors.find((c) => c.id === collectorId);
    return collector ? collector.name : "Unknown";
  };

  const emailLogs = logs.filter((l) => l.campaignType === "email");
  const search = searchTerm.trim().toLowerCase();
  const filteredEmailLogs = search
    ? emailLogs.filter((l) => l.campaignName.toLowerCase().includes(search))
    : emailLogs;

  const sentLogs = filteredEmailLogs.filter((l) => l.status === "sent" || l.status === "partial");
  const failedLogs = filteredEmailLogs.filter((l) => l.status === "failed");
  const pendingLogs = filteredEmailLogs.filter((l) => l.status === "pending");
  const sentToday = emailLogs.filter((l) => (l.status === "sent" || l.status === "partial") && isToday(l.sentDate));
  const recipientsReached = emailLogs
    .filter((l) => l.status === "sent" || l.status === "partial")
    .reduce((sum, l) => sum + (l.totalAccounts || 0), 0);

  const renderLogRow = (log: CampaignLog) => {
    const status = statusBadge[log.status] || statusBadge.pending;
    return (
      <div
        key={log.id}
        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
        data-testid={`row-email-${log.id}`}
      >
        <div className="flex items-center gap-4 min-w-0">
          {log.status === "failed" ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate">{log.campaignName}</p>
            <p className="text-sm text-muted-foreground">Sent by {getSenderName(log.sentBy)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Badge variant="outline" className="font-mono text-xs">
            <Users className="h-3 w-3 mr-1" />
            {log.totalAccounts}
          </Badge>
          <Badge variant="secondary" className={status.className}>{status.label}</Badge>
          <span className="text-sm text-muted-foreground">{formatDateTime(log.sentDate)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Management</h1>
          <p className="text-muted-foreground">Track outbound email activity sent to debtors</p>
        </div>
        <Button asChild data-testid="button-compose">
          <Link href="/app/admin/email/templates">
            <Mail className="h-4 w-4 mr-2" />
            Compose
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Send className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-sent">{sentLogs.length}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-recipients">{recipientsReached}</p>
                <p className="text-sm text-muted-foreground">Recipients Reached</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-failed">{failedLogs.length}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-sent-today">{sentToday.length}</p>
                <p className="text-sm text-muted-foreground">Sent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by campaign or message name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 max-w-md"
          data-testid="input-search"
        />
      </div>

      <Tabs defaultValue="sent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sent" data-testid="tab-sent">
            <Send className="h-4 w-4 mr-2" />
            Sent ({sentLogs.length})
          </TabsTrigger>
          <TabsTrigger value="failed" data-testid="tab-failed">
            <AlertCircle className="h-4 w-4 mr-2" />
            Failed ({failedLogs.length})
          </TabsTrigger>
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Inbox
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardDescription>
                Every row is a real email send recorded through your connected Chain delivery provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : sentLogs.length === 0 && pendingLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No sent emails yet</p>
                  </div>
                ) : (
                  [...pendingLogs, ...sentLogs].map(renderLogRow)
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardDescription>
                Sends that your Chain delivery provider rejected or could not complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : failedLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No failed emails</p>
                  </div>
                ) : (
                  failedLogs.map(renderLogRow)
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Inbound email replies are not captured by this system.</p>
                <p className="text-sm mt-1">
                  This page only tracks emails your organization has sent. Configure your Chain provider directly if it offers reply handling.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
