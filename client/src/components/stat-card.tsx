import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </span>
            <span className="text-2xl font-semibold font-mono tracking-tight">
              {value}
            </span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend.isPositive ? "+" : ""}{trend.value}% from last month
              </span>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
