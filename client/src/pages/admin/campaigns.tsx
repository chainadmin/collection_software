import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Megaphone, Mail, MessageSquare } from "lucide-react";
import type { CampaignLog, CampaignLogItem } from "@shared/schema";

type CampaignLogDetail = CampaignLog & { items: CampaignLogItem[] };

const logStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  pending: "secondary",
  partial: "outline",
  failed: "destructive",
};

const itemStatusColor: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  replied: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "opted-out": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
};

function formatDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function Campaigns() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery<CampaignLog[]>({
    queryKey: ["/api/campaign-logs"],
  });

  const { data: detail } = useQuery<CampaignLogDetail>({
    queryKey: ["/api/campaign-logs", selectedId],
    enabled: !!selectedId,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Campaign History
        </h1>
        <p className="text-muted-foreground">
          Review template campaigns you've sent and the delivery status for each account
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Sent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No campaigns sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedId(log.id)}
                    data-testid={`row-campaign-${log.id}`}
                  >
                    <TableCell className="font-medium">{log.campaignName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        {log.campaignType === "email" ? (
                          <Mail className="h-3 w-3" />
                        ) : (
                          <MessageSquare className="h-3 w-3" />
                        )}
                        {log.campaignType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.totalAccounts}</TableCell>
                    <TableCell>
                      <Badge variant={logStatusVariant[log.status] || "secondary"}>{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(log.sentDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-campaign-detail">
          <DialogHeader>
            <DialogTitle>{detail?.campaignName}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.totalAccounts} account(s) · sent ${formatDate(detail.sentDate)}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>
          {detail?.errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-400">
              {detail.errorMessage}
            </div>
          )}
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File #</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail?.items || []).map((item) => (
                  <TableRow key={item.id} data-testid={`row-campaign-item-${item.id}`}>
                    <TableCell className="font-medium">{item.fileNumber}</TableCell>
                    <TableCell className="text-sm">{item.contactValue}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          itemStatusColor[item.status] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
