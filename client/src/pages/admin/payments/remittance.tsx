import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Calendar, Download, DollarSign, FileText, Filter, User, Hash } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Portfolio, Client, Payment, Debtor } from "@shared/schema";

export default function Remittance() {
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: debtors = [], isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/debtors"],
  });

  const filteredPortfolios = useMemo(() => {
    if (selectedClientId === "all") return portfolios;
    return portfolios.filter((p) => p.clientId === selectedClientId);
  }, [portfolios, selectedClientId]);

  const completedPayments = useMemo(() => {
    return payments.filter((p) => p.status === "completed" || p.status === "processed");
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let filtered = completedPayments;

    if (selectedPortfolioId !== "all") {
      const portfolioDebtorIds = debtors
        .filter((d) => d.portfolioId === selectedPortfolioId)
        .map((d) => d.id);
      filtered = filtered.filter((p) => portfolioDebtorIds.includes(p.debtorId));
    } else if (selectedClientId !== "all") {
      const clientPortfolioIds = portfolios
        .filter((p) => p.clientId === selectedClientId)
        .map((p) => p.id);
      const clientDebtorIds = debtors
        .filter((d) => clientPortfolioIds.includes(d.portfolioId))
        .map((d) => d.id);
      filtered = filtered.filter((p) => clientDebtorIds.includes(p.debtorId));
    }

    if (startDate) {
      filtered = filtered.filter((p) => p.paymentDate && p.paymentDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((p) => p.paymentDate && p.paymentDate <= endDate);
    }

    return filtered;
  }, [completedPayments, selectedClientId, selectedPortfolioId, portfolios, debtors, startDate, endDate]);

  const paymentsWithDetails = useMemo(() => {
    return filteredPayments.map((payment) => {
      const debtor = debtors.find((d) => d.id === payment.debtorId);
      const portfolio = debtor ? portfolios.find((p) => p.id === debtor.portfolioId) : null;
      const client = portfolio ? clients.find((c) => c.id === portfolio.clientId) : null;

      return {
        ...payment,
        debtor,
        portfolio,
        client,
      };
    }).sort((a, b) => {
      if (!a.paymentDate || !b.paymentDate) return 0;
      return b.paymentDate.localeCompare(a.paymentDate);
    });
  }, [filteredPayments, debtors, portfolios, clients]);

  const totalCollected = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  }, [filteredPayments]);

  const summaryByClient = useMemo(() => {
    const summary: Record<string, { clientName: string; total: number; count: number }> = {};
    
    for (const payment of paymentsWithDetails) {
      const clientId = payment.client?.id || "unknown";
      const clientName = payment.client?.name || "Unknown Client";
      
      if (!summary[clientId]) {
        summary[clientId] = { clientName, total: 0, count: 0 };
      }
      summary[clientId].total += Number(payment.amount);
      summary[clientId].count += 1;
    }

    return Object.entries(summary).map(([id, data]) => ({
      clientId: id,
      ...data,
    }));
  }, [paymentsWithDetails]);

  const summaryByPortfolio = useMemo(() => {
    const summary: Record<string, { portfolioName: string; clientName: string; total: number; count: number }> = {};
    
    for (const payment of paymentsWithDetails) {
      const portfolioId = payment.portfolio?.id || "unknown";
      const portfolioName = payment.portfolio?.name || "Unknown Portfolio";
      const clientName = payment.client?.name || "Unknown Client";
      
      if (!summary[portfolioId]) {
        summary[portfolioId] = { portfolioName, clientName, total: 0, count: 0 };
      }
      summary[portfolioId].total += Number(payment.amount);
      summary[portfolioId].count += 1;
    }

    return Object.entries(summary).map(([id, data]) => ({
      portfolioId: id,
      ...data,
    }));
  }, [paymentsWithDetails]);

  const handleExportCSV = () => {
    const headers = ["Date", "Account #", "Debtor Name", "Client", "Portfolio", "Amount", "Method", "Confirmation"];
    const rows = paymentsWithDetails.map((p) => [
      p.paymentDate || "",
      p.debtor?.accountNumber || "",
      p.debtor ? `${p.debtor.firstName} ${p.debtor.lastName}` : "",
      p.client?.name || "",
      p.portfolio?.name || "",
      (Number(p.amount) / 100).toFixed(2),
      p.paymentMethod || "",
      p.referenceNumber || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remittance-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = portfoliosLoading || clientsLoading || paymentsLoading || debtorsLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Remittance Report</h1>
          <p className="text-muted-foreground">Detailed payment breakdown by client and portfolio</p>
        </div>
        <Button onClick={handleExportCSV} disabled={paymentsWithDetails.length === 0} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedPortfolioId("all"); }}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Portfolio</Label>
              <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
                <SelectTrigger data-testid="select-portfolio">
                  <SelectValue placeholder="All Portfolios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Portfolios</SelectItem>
                  {filteredPortfolios.map((portfolio) => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>{portfolio.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredPayments.length}</p>
                <p className="text-sm text-muted-foreground">Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalCollected)}</p>
                <p className="text-sm text-muted-foreground">Total Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryByClient.length}</p>
                <p className="text-sm text-muted-foreground">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Calendar className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryByPortfolio.length}</p>
                <p className="text-sm text-muted-foreground">Portfolios</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details" data-testid="tab-details">
            Payment Details
          </TabsTrigger>
          <TabsTrigger value="by-client" data-testid="tab-by-client">
            By Client
          </TabsTrigger>
          <TabsTrigger value="by-portfolio" data-testid="tab-by-portfolio">
            By Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
              <CardDescription>Individual payment breakdown with debtor information</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : paymentsWithDetails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No payments found for the selected filters
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm">Date</th>
                        <th className="text-left p-3 font-medium text-sm">Account #</th>
                        <th className="text-left p-3 font-medium text-sm">Debtor</th>
                        <th className="text-left p-3 font-medium text-sm">Client</th>
                        <th className="text-left p-3 font-medium text-sm">Portfolio</th>
                        <th className="text-right p-3 font-medium text-sm">Amount</th>
                        <th className="text-center p-3 font-medium text-sm">Method</th>
                        <th className="text-left p-3 font-medium text-sm">Reference #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paymentsWithDetails.map((payment) => (
                        <tr key={payment.id} className="hover-elevate" data-testid={`row-payment-${payment.id}`}>
                          <td className="p-3 text-sm">{formatDate(payment.paymentDate || "")}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Hash className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-sm">{payment.debtor?.accountNumber || "-"}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {payment.debtor ? `${payment.debtor.firstName} ${payment.debtor.lastName}` : "-"}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-sm">{payment.client?.name || "-"}</td>
                          <td className="p-3 text-sm">{payment.portfolio?.name || "-"}</td>
                          <td className="p-3 text-right">
                            <span className="font-mono font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(Number(payment.amount))}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary">{payment.paymentMethod || "-"}</Badge>
                          </td>
                          <td className="p-3 text-sm font-mono text-muted-foreground">
                            {payment.referenceNumber || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={5} className="p-3 text-right font-medium">Total:</td>
                        <td className="p-3 text-right font-mono font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(totalCollected)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-client">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary by Client</CardTitle>
              <CardDescription>Collections grouped by client</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : summaryByClient.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No payments found for the selected filters
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm">Client</th>
                        <th className="text-center p-3 font-medium text-sm">Payment Count</th>
                        <th className="text-right p-3 font-medium text-sm">Total Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summaryByClient.map((row) => (
                        <tr key={row.clientId} className="hover-elevate" data-testid={`row-client-summary-${row.clientId}`}>
                          <td className="p-3 font-medium">{row.clientName}</td>
                          <td className="p-3 text-center">{row.count}</td>
                          <td className="p-3 text-right">
                            <span className="font-mono font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(row.total)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td className="p-3 font-medium">Total</td>
                        <td className="p-3 text-center font-medium">{filteredPayments.length}</td>
                        <td className="p-3 text-right font-mono font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(totalCollected)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-portfolio">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary by Portfolio</CardTitle>
              <CardDescription>Collections grouped by portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : summaryByPortfolio.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No payments found for the selected filters
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm">Portfolio</th>
                        <th className="text-left p-3 font-medium text-sm">Client</th>
                        <th className="text-center p-3 font-medium text-sm">Payment Count</th>
                        <th className="text-right p-3 font-medium text-sm">Total Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summaryByPortfolio.map((row) => (
                        <tr key={row.portfolioId} className="hover-elevate" data-testid={`row-portfolio-summary-${row.portfolioId}`}>
                          <td className="p-3 font-medium">{row.portfolioName}</td>
                          <td className="p-3 text-sm text-muted-foreground">{row.clientName}</td>
                          <td className="p-3 text-center">{row.count}</td>
                          <td className="p-3 text-right">
                            <span className="font-mono font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(row.total)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={2} className="p-3 font-medium">Total</td>
                        <td className="p-3 text-center font-medium">{filteredPayments.length}</td>
                        <td className="p-3 text-right font-mono font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(totalCollected)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
