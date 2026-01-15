import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Download, TrendingUp, Phone, DollarSign, Target, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import type { Collector } from "@shared/schema";

export default function CollectorReporting() {
  const [dateRange, setDateRange] = useState("this_month");
  const [selectedCollector, setSelectedCollector] = useState("");

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const collectorMetrics = collectors.map((c) => ({
    ...c,
    collections: Math.floor(Math.random() * 1000000) + 200000,
    callsMade: Math.floor(Math.random() * 500) + 100,
    promisesSecured: Math.floor(Math.random() * 50) + 10,
    accountsWorked: Math.floor(Math.random() * 100) + 20,
    avgCallDuration: Math.floor(Math.random() * 180) + 60,
    conversionRate: Math.random() * 0.3 + 0.1,
  }));

  const totalCollections = collectorMetrics.reduce((sum, c) => sum + c.collections, 0);
  const totalCalls = collectorMetrics.reduce((sum, c) => sum + c.callsMade, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collector Reporting</h1>
          <p className="text-muted-foreground">Individual and team performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{collectors.length}</p>
                <p className="text-sm text-muted-foreground">Active Collectors</p>
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
                <p className="text-2xl font-bold">{formatCurrency(totalCollections)}</p>
                <p className="text-sm text-muted-foreground">Total Collections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Phone className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Target className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">24.5%</p>
                <p className="text-sm text-muted-foreground">Avg Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Collector Performance</CardTitle>
          <CardDescription>Detailed metrics for each collector</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Collector</th>
                  <th className="text-right py-3 px-4 font-medium">Collections</th>
                  <th className="text-right py-3 px-4 font-medium">Calls</th>
                  <th className="text-right py-3 px-4 font-medium">Promises</th>
                  <th className="text-right py-3 px-4 font-medium">Accounts</th>
                  <th className="text-right py-3 px-4 font-medium">Avg Call</th>
                  <th className="text-right py-3 px-4 font-medium">Conv. Rate</th>
                  <th className="text-right py-3 px-4 font-medium">Goal Progress</th>
                </tr>
              </thead>
              <tbody>
                {collectorMetrics.map((collector) => {
                  const goalProgress = collector.goal ? (collector.collections / collector.goal) * 100 : 0;
                  return (
                    <tr key={collector.id} className="border-b hover:bg-muted/50" data-testid={`row-collector-${collector.id}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{collector.avatarInitials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{collector.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{collector.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">{formatCurrency(collector.collections)}</td>
                      <td className="text-right py-3 px-4">{collector.callsMade}</td>
                      <td className="text-right py-3 px-4">{collector.promisesSecured}</td>
                      <td className="text-right py-3 px-4">{collector.accountsWorked}</td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {Math.floor(collector.avgCallDuration / 60)}:{(collector.avgCallDuration % 60).toString().padStart(2, '0')}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant={collector.conversionRate >= 0.25 ? "default" : "secondary"}>
                          {(collector.conversionRate * 100).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${goalProgress >= 100 ? "bg-green-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(goalProgress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10">{goalProgress.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
