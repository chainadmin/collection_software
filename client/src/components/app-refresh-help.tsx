import { useState } from "react";
import { RefreshCw, HelpCircle } from "lucide-react";
import { forcePwaRefresh } from "@/lib/pwa-update";

export function AppRefreshHelp() {
  const [showHelp, setShowHelp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <div className="mt-4 text-center" data-testid="section-app-refresh-help">
      <button
        type="button"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true);
          void forcePwaRefresh();
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        data-testid="button-force-refresh"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing…" : "Seeing an old version? Refresh to the latest"}
      </button>
      <div>
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-toggle-reinstall-help"
        >
          <HelpCircle className="h-3 w-3" />
          Need a fresh install?
        </button>
      </div>
      {showHelp && (
        <div
          className="mx-auto mt-2 max-w-sm rounded-md border bg-muted/50 p-3 text-left text-xs text-muted-foreground"
          data-testid="card-reinstall-help"
        >
          <p className="font-medium text-foreground">To fully reinstall on a computer:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Open the installed app, then open its menu (the ⋯ icon in the title bar).</li>
            <li>
              Choose <strong>Uninstall</strong> (Chrome/Edge). You can also visit{" "}
              <code>chrome://apps</code>, right-click the app, and pick Remove.
            </li>
            <li>Come back to this page and click Install again.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
