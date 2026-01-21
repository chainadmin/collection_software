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
import type { Portfolio, Client } from "@shared/schema";

export default function Remittance() {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [dateRange, setDateRange] = useState("this_month");
  const [selectedClient, setSelectedClient] = useState("");

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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

  const clientRemittances = [
    { 
      clientId: "1", 
      clientName: "Chase Bank", 
      remittanceMethod: "ACH",
      portfolioCount: 2,
      pendingAmount: 12875000,
      lastRemittance: "2024-12-15",
      nextDue: "2025-01-15",
      contact: "John Smith",
      email: "remittance@chase.com"
    },
    { 
      clientId: "2", 
      clientName: "Capital One", 
      remittanceMethod: "Wire",
      portfolioCount: 1,
      pendingAmount: 6125000,
      lastRemittance: "2024-12-15",
      nextDue: "2025-01-15",
      contact: "Jane Doe",
      email: "collections@capitalone.com"
    },
    { 
      clientId: "3", 
      clientName: "Ford Motor Credit", 
      remittanceMethod: "Check",
      portfolioCount: 1,
      pendingAmount: 0,
      lastRemittance: "2024-12-15",
      nextDue: "2025-01-15",
      contact: "Bob Wilson",
      email: "finance@fordcredit.com"
    },
  ];

  const totalClientPending = clientRemittances.reduce((sum, c) => sum + c.pendingAmount, 0);

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

      <Tabs defaultValue="by-client" className="space-y-4">
        <TabsList>
          <TabsTrigger value="by-client" data-testid="tab-by-client">
            By Client
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRemittances.length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent">
            Sent ({sentRemittances.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="by-client">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Remittance Summary</CardTitle>
              <CardDescription>Overview of amounts owed to each client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Client</th>
                      <th className="text-left p-3 font-medium text-sm">Contact</th>
                      <th className="text-center p-3 font-medium text-sm">Method</th>
                      <th className="text-center p-3 font-medium text-sm">Portfolios</th>
                      <th className="text-right p-3 font-medium text-sm">Pending Amount</th>
                      <th className="text-left p-3 font-medium text-sm">Next Due</th>
                      <th className="text-right p-3 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clientRemittances.map((client) => (
                      <tr key={client.clientId} className="hover-elevate" data-testid={`row-client-remittance-${client.clientId}`}>
                        <td className="p-3">
                          <p className="font-medium">{client.clientName}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </td>
                        <td className="p-3 text-sm">{client.contact}</td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary">{client.remittanceMethod}</Badge>
                        </td>
                        <td className="p-3 text-center text-sm">{client.portfolioCount}</td>
                        <td className="p-3 text-right">
                          {client.pendingAmount > 0 ? (
                            <span className="font-mono font-medium text-yellow-600 dark:text-yellow-400">
                              {formatCurrency(client.pendingAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">$0.00</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">{formatDate(client.nextDue)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" data-testid={`button-view-client-${client.clientId}`}>
                              View Details
                            </Button>
                            {client.pendingAmount > 0 && (
                              <Button size="sm" data-testid={`button-send-client-${client.clientId}`}>
                                <Send className="h-4 w-4 mr-1" />
                                Send
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-medium">Total Owed to Clients:</td>
                      <td className="p-3 text-right font-mono font-bold">{formatCurrency(totalClientPending)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
