import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import {
  applyPwaUpdate,
  isPwaUpdateAvailable,
} from "@/lib/pwa-update";

export function UpdatePrompt() {
  const [available, setAvailable] = useState(isPwaUpdateAvailable);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onAvailable = () => {
      setAvailable(true);
      setDismissed(false);
    };
    window.addEventListener("pwa-update-available", onAvailable);
    return () => window.removeEventListener("pwa-update-available", onAvailable);
  }, []);

  if (!available || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg"
      data-testid="banner-update-available"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">A new version is available</p>
          <p className="text-sm text-muted-foreground">
            Reload to get the latest version of the app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
          data-testid="button-dismiss-update"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            applyPwaUpdate();
          }}
          data-testid="button-apply-update"
        >
          {updating ? "Updating…" : "Reload to update"}
        </Button>
      </div>
    </div>
  );
}
