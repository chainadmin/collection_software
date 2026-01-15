import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Calendar, Download, Send, DollarSign, FileText, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Portfolio } from "@shared/schema";

export default function Remittance() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [dateRange, setDateRange] = useState("this_month");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const sampleRemittances = [
    { id: "1", portfolio: "Chase Q4 2024", client: "Chase Bank", period: "Dec 2024", collections: 12500000, fees: 3125000, netRemit: 9375000, status: "pending", dueDate: "2025-01-15" },
    { id: "2", portfolio: "Capital One Medical", client: "Capital One", period: "Dec 2024", collections: 8750000, fees: 2625000, netRemit: 6125000, status: "pending", dueDate: "2025-01-15" },
    { id: "3", portfolio: "Chase Q4 2024", client: "Chase Bank", period: "Nov 2024", collections: 14200000, fees: 3550000, netRemit: 10650000, status: "sent", dueDate: "2024-12-15" },
    { id: "4", portfolio: "Auto Loan Portfolio A", client: "Ford Motor Credit", period: "Nov 2024", collections: 22500000, fees: 4500000, netRemit: 18000000, status: "sent", dueDate: "2024-12-15" },
  ];

  const pendingRemittances = sampleRemittances.filter((r) => r.status === "pending");
  const sentRemittances = sampleRemittances.filter((r) => r.status === "sent");

  const totalPending = pendingRemittances.reduce((sum, r) => sum + r.netRemit, 0);

  const handleSendRemittance = (id: string) => {
    toast({ title: "Remittance Sent", description: "Remittance report has been sent to the client." });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Remittance</h1>
          <p className="text-muted-foreground">Client payment remittance reporting</p>
        </div>
        <Button data-testid="button-generate-report">
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRemittances.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <DollarSign className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                <p className="text-sm text-muted-foreground">Due to Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sentRemittances.length}</p>
                <p className="text-sm text-muted-foreground">Sent This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">Jan 15</p>
                <p className="text-sm text-muted-foreground">Next Due Date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRemittances.length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            Sent ({sentRemittances.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Remittances</CardTitle>
              <CardDescription>Ready for client disbursement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingRemittances.map((remit) => (
                  <div key={remit.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-remittance-${remit.id}`}>
                    <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="font-medium">{remit.portfolio}</p>
                        <p className="text-sm text-muted-foreground">{remit.client}</p>
                      </div>
                      <div>
                        <p className="text-sm">{remit.period}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(remit.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{formatCurrency(remit.collections)}</p>
                        <p className="text-xs text-muted-foreground">Collected</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-muted-foreground">-{formatCurrency(remit.fees)}</p>
                        <p className="text-xs text-muted-foreground">Fees (25%)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium">{formatCurrency(remit.netRemit)}</p>
                        <p className="text-xs text-muted-foreground">Net Remit</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="outline" size="sm" data-testid={`button-download-${remit.id}`}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleSendRemittance(remit.id)} data-testid={`button-send-${remit.id}`}>
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sent Remittances</CardTitle>
              <CardDescription>Previously disbursed to clients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sentRemittances.map((remit) => (
                  <div key={remit.id} className="flex items-center justify-between p-4 border rounded-lg opacity-75" data-testid={`row-remittance-${remit.id}`}>
                    <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="font-medium">{remit.portfolio}</p>
                        <p className="text-sm text-muted-foreground">{remit.client}</p>
                      </div>
                      <div>
                        <p className="text-sm">{remit.period}</p>
                        <Badge variant="secondary" className="mt-1">Sent</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{formatCurrency(remit.collections)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-muted-foreground">-{formatCurrency(remit.fees)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(remit.netRemit)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-4">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
