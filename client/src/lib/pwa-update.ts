// Service worker registration + update handling.
//
// Design goals (see Task: Reliable desktop app updates):
// - Each deploy ships a versioned service worker (server injects the version),
//   so the browser reliably detects a new version.
// - A waiting worker does NOT take over mid-task. Instead we surface a
//   "new version available" prompt and let the user apply it in one click.
// - When the app is fully closed and relaunched, the waiting worker activates
//   on its own, so a relaunch always lands on the latest version.

const UPDATE_AVAILABLE_EVENT = "pwa-update-available";

let waitingWorker: ServiceWorker | null = null;
let refreshing = false;
let registered = false;

function announceUpdateAvailable(worker: ServiceWorker) {
  waitingWorker = worker;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  }
}

export function isPwaUpdateAvailable(): boolean {
  return Boolean(waitingWorker);
}

/**
 * Activate the waiting service worker and reload to the new version. Safe to
 * call even if nothing is waiting (falls back to a plain reload).
 */
export function applyPwaUpdate(): void {
  if (typeof window === "undefined") return;
  refreshing = true;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // controllerchange (below) triggers the reload once the new worker takes
    // control. Fall back to a direct reload in case that event doesn't fire.
    window.setTimeout(() => {
      if (refreshing) window.location.reload();
    }, 3000);
  } else {
    window.location.reload();
  }
}

/**
 * Last-resort "force refresh": unregister all service workers, clear every
 * cache, and reload. Use when a user is stuck on a stale version.
 */
export async function forcePwaRefresh(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (typeof caches !== "undefined" && caches.keys) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)));
    }
  } catch {
    /* ignore */
  }
  // Bust the HTTP cache for the document on reload.
  window.location.reload();
}

export function registerPwaUpdates(): void {
  if (registered) return;
  registered = true;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // A worker may already be waiting from a previous visit.
        if (registration.waiting && navigator.serviceWorker.controller) {
          announceUpdateAvailable(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // "installed" + an existing controller means this is an update to
            // an already-running app (not a first install).
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              announceUpdateAvailable(newWorker);
            }
          });
        });

        // Check for an update right away (e.g. app left open for days).
        registration.update().catch(() => undefined);
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });

    // Reload exactly once when a worker we asked to activate takes control.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        refreshing = false;
        window.location.reload();
      }
    });
  });
}
