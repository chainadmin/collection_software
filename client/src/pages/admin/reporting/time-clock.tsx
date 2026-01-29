import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Download, Calendar, Play, Square, Coffee, Users, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Collector, TimeClockEntry } from "@shared/schema";

export default function TimeClock() {
  const [dateRange, setDateRange] = useState("this_week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: collectors = [], isLoading: collectorsLoading } = useQuery<Collector[]>({
    queryKey: ["/api/collectors"],
  });

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery<TimeClockEntry[]>({
    queryKey: ["/api/time-clock"],
  });

  // Helper to extract date from clockIn timestamp
  const getDateFromClockIn = (clockIn: string): string => {
    try {
      return new Date(clockIn).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  // Calculate real time data from actual entries
  const collectorTimeData = useMemo(() => {
    const today = selectedDate;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];

    return collectors.map((c) => {
      const collectorEntries = timeEntries.filter((e) => e.collectorId === c.id);
      const todayEntries = collectorEntries.filter((e) => getDateFromClockIn(e.clockIn) === today);
      const weekEntries = collectorEntries.filter((e) => {
        const entryDate = getDateFromClockIn(e.clockIn);
        return entryDate && entryDate >= weekStartStr;
      });

      // Check if currently clocked in (entry with no clockOut)
      const activeEntry = todayEntries.find((e) => !e.clockOut);

      // Calculate total hours today
      const hoursToday = todayEntries.reduce((total, entry) => {
        if (!entry.clockIn) return total;
        const clockIn = new Date(entry.clockIn);
        const clockOut = entry.clockOut
          ? new Date(entry.clockOut)
          : new Date();
        const diff = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        return total + Math.max(0, diff);
      }, 0);

      // Calculate total hours this week
      const hoursThisWeek = weekEntries.reduce((total, entry) => {
        if (!entry.clockIn || !entry.clockOut) return total;
        const clockIn = new Date(entry.clockIn);
        const clockOut = new Date(entry.clockOut);
        const diff = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        return total + Math.max(0, diff);
      }, 0);

      return {
        collector: c,
        clockedIn: !!activeEntry,
        clockInTime: activeEntry?.clockIn || null,
        totalToday: hoursToday,
        totalWeek: hoursThisWeek,
        status: activeEntry ? "working" : "off",
      };
    });
  }, [collectors, timeEntries, selectedDate]);

  // Calculate weekly report from actual entries
  const weeklyReport = useMemo(() => {
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

      const dayEntries = timeEntries.filter((e) => getDateFromClockIn(e.clockIn) === dateStr);
      const hours = dayEntries.reduce((total, entry) => {
        if (!entry.clockIn || !entry.clockOut) return total;
        const clockIn = new Date(entry.clockIn);
        const clockOut = new Date(entry.clockOut);
        const diff = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        return total + Math.max(0, diff);
      }, 0);

      days.push({
        date: `${dayName} ${dayNum}`,
        hours: Math.round(hours * 10) / 10,
        overtime: Math.max(0, hours - 8),
      });
    }

    return days;
  }, [timeEntries, selectedDate]);

  const activeCount = collectorTimeData.filter((d) => d.clockedIn).length;
  const onBreakCount = collectorTimeData.filter((d) => d.status === "break").length;
  const totalHoursToday = collectorTimeData.reduce((sum, d) => sum + d.totalToday, 0);
  const totalHoursWeek = collectorTimeData.reduce((sum, d) => sum + d.totalWeek, 0);

  const isLoading = collectorsLoading || entriesLoading;

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
                <p className="text-2xl font-bold">{totalHoursToday.toFixed(1)}</p>
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
                <p className="text-2xl font-bold">{totalHoursWeek.toFixed(1)}</p>
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
            {collectorTimeData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No collectors found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {collectorTimeData.map((entry) => {
                  const clockInDisplay = entry.clockInTime 
                    ? new Date(entry.clockInTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    : null;
                  return (
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
                            {entry.clockedIn ? `Clocked in at ${clockInDisplay}` : "Not clocked in"}
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
                  );
                })}
              </div>
            )}
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
