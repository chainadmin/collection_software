import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Download, Calendar, Play, Square, Coffee, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Collector, TimeClockEntry } from "@shared/schema";

export default function TimeClock() {
  const [dateRange, setDateRange] = useState("this_week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: collectors = [] } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: timeEntries = [] } = useQuery<TimeClockEntry[]>({
    queryKey: ["/api/time-clock"],
  });

  const sampleTimeData = collectors.map((c) => ({
    collector: c,
    clockedIn: Math.random() > 0.3,
    clockInTime: "08:32 AM",
    totalToday: 7.5,
    totalWeek: 38.5,
    breaks: 2,
    breakTime: 45,
    status: Math.random() > 0.5 ? "working" : "break",
  }));

  const weeklyReport = [
    { date: "Mon 12/9", hours: 8.0, overtime: 0 },
    { date: "Tue 12/10", hours: 8.5, overtime: 0.5 },
    { date: "Wed 12/11", hours: 7.5, overtime: 0 },
    { date: "Thu 12/12", hours: 9.0, overtime: 1.0 },
    { date: "Fri 12/13", hours: 8.0, overtime: 0 },
  ];

  const activeCount = sampleTimeData.filter((d) => d.clockedIn).length;
  const onBreakCount = sampleTimeData.filter((d) => d.status === "break").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Time Clock</h1>
          <p className="text-muted-foreground">Track collector working hours</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[150px]"
            data-testid="input-date"
          />
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
              <div className="p-3 rounded-lg bg-green-500/10">
                <Play className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Currently Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Coffee className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onBreakCount}</p>
                <p className="text-sm text-muted-foreground">On Break</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">45.2</p>
                <p className="text-sm text-muted-foreground">Hours Today</p>
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
                <p className="text-2xl font-bold">192.5</p>
                <p className="text-sm text-muted-foreground">Hours This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Today's Status</CardTitle>
            <CardDescription>{formatDate(selectedDate)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sampleTimeData.map((entry) => (
                <div 
                  key={entry.collector.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`row-collector-${entry.collector.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{entry.collector.avatarInitials}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                        entry.clockedIn 
                          ? entry.status === "break" ? "bg-yellow-500" : "bg-green-500"
                          : "bg-muted"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{entry.collector.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.clockedIn ? `Clocked in at ${entry.clockInTime}` : "Not clocked in"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-mono">{entry.totalToday.toFixed(1)} hrs</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{entry.totalWeek.toFixed(1)} hrs</p>
                      <p className="text-xs text-muted-foreground">This Week</p>
                    </div>
                    <Badge variant={
                      !entry.clockedIn ? "secondary" : 
                      entry.status === "break" ? "outline" : "default"
                    }>
                      {!entry.clockedIn ? "Offline" : entry.status === "break" ? "On Break" : "Working"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Summary</CardTitle>
            <CardDescription>Team hours by day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyReport.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{day.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{day.hours} hrs</span>
                    {day.overtime > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{day.overtime} OT
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between font-medium">
                  <span>Week Total</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">41.0 hrs</span>
                    <Badge variant="outline">1.5 OT</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
