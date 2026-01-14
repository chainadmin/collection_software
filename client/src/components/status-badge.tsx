import { Badge } from "@/components/ui/badge";

type StatusType = 
  | "open" 
  | "in_payment" 
  | "settled" 
  | "closed" 
  | "disputed"
  | "active"
  | "inactive"
  | "suspended"
  | "pending"
  | "processed"
  | "failed"
  | "refunded"
  | "draft"
  | "queued"
  | "processing"
  | "completed"
  | "archived";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_payment: { label: "In Payment", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  settled: { label: "Settled", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  processed: { label: "Processed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  refunded: { label: "Refunded", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400" },
  queued: { label: "Queued", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  processing: { label: "Processing", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400" },
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
}

export function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || {
    label: status,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  };

  return (
    <Badge
      variant="outline"
      className={`${config.className} border-transparent font-medium ${
        size === "sm" ? "text-xs px-1.5 py-0" : ""
      }`}
    >
      {config.label}
    </Badge>
  );
}
