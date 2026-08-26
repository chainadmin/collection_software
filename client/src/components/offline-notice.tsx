import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineNotice() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-2 top-2 z-[110] mx-auto flex max-w-xl items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-background px-4 py-3 text-sm shadow-lg"
      data-testid="banner-offline"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span>You&apos;re offline. Reconnect to access current account information.</span>
    </div>
  );
}
