import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";

interface DueAlert {
  id: string;
  message: string;
  fromCollectorName: string;
}

const POLL_INTERVAL_MS = 30_000;

/** Polls for reminders other collectors left for the current user and pops each one up as a toast, once. */
export function useCollectorAlerts(enabled: boolean) {
  const { toast } = useToast();
  const shown = useRef(new Set<string>());

  const { data } = useQuery<DueAlert[]>({
    queryKey: ["/api/alerts/due"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!data) return;
    for (const alert of data) {
      if (shown.current.has(alert.id)) continue;
      shown.current.add(alert.id);
      toast({ title: `Reminder from ${alert.fromCollectorName}`, description: alert.message });
    }
  }, [data, toast]);
}
