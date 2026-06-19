import { useCallback, useEffect, useState } from "react";

export type PwaInstallState =
  | "can-prompt"
  | "ios-safari"
  | "android-no-prompt"
  | "desktop-no-prompt"
  | "installed";

export type PwaMode = "admin" | "collector";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getStoredPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return ((window as any).__pwaInstallPrompt as BeforeInstallPromptEvent) ?? null;
}

function getStoredPromptMode(): PwaMode | null {
  if (typeof window === "undefined") return null;
  return ((window as any).__pwaInstallPromptMode as PwaMode) ?? null;
}

function clearStoredPrompt() {
  if (typeof window === "undefined") return;
  (window as any).__pwaInstallPrompt = null;
  (window as any).__pwaInstallPromptMode = null;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as any)?.standalone === true;
  return Boolean(mediaStandalone || iosStandalone);
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPhoneOrPad = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as "MacIntel" but has a touch screen.
  const iPadOnDesktopUa =
    navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iPhoneOrPad || iPadOnDesktopUa;
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

/**
 * Single source of truth for "how do I install this PWA on this device?".
 *
 * Pass the `mode` of the button ("admin" or "collector") so we only treat the
 * native prompt as usable when it was captured for the matching app. The global
 * capture in App.tsx stores the deferred prompt on `window.__pwaInstallPrompt`,
 * the app it belongs to on `window.__pwaInstallPromptMode`, and dispatches
 * `pwa-install-available` / `pwa-installed`, so this hook stays in sync even if
 * the prompt fired before the component mounted.
 */
export function usePwaInstall(mode?: PwaMode) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    getStoredPrompt,
  );
  const [promptMode, setPromptMode] = useState<PwaMode | null>(getStoredPromptMode);
  const [installed, setInstalled] = useState<boolean>(isStandalone);

  useEffect(() => {
    const syncPrompt = () => {
      setPromptEvent(getStoredPrompt());
      setPromptMode(getStoredPromptMode());
    };
    const markInstalled = () => {
      setInstalled(true);
      clearStoredPrompt();
      setPromptEvent(null);
      setPromptMode(null);
    };

    window.addEventListener("pwa-install-available", syncPrompt);
    window.addEventListener("pwa-installed", markInstalled);
    window.addEventListener("appinstalled", markInstalled);

    // Re-check on mount in case the event fired before we subscribed.
    syncPrompt();
    if (isStandalone()) setInstalled(true);

    return () => {
      window.removeEventListener("pwa-install-available", syncPrompt);
      window.removeEventListener("pwa-installed", markInstalled);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  // Detect "already installed" even from a normal browser tab (not just when
  // running standalone). getInstalledRelatedApps reports the related app
  // declared in the active manifest; we scope the result to this button's app.
  useEffect(() => {
    let cancelled = false;
    const nav = navigator as any;
    if (typeof nav?.getInstalledRelatedApps !== "function") return;

    const expectedId = mode === "collector" ? "dmp-collector" : "dmp-admin";
    nav
      .getInstalledRelatedApps()
      .then((apps: Array<{ id?: string; url?: string; platform?: string }>) => {
        if (cancelled || !Array.isArray(apps) || apps.length === 0) return;
        const match = apps.some((app) => {
          if (app?.id) return app.id === expectedId;
          if (app?.url)
            return mode === "collector"
              ? app.url.includes("collector")
              : !app.url.includes("collector");
          // No identifying info — fall back to "an app is installed".
          return true;
        });
        if (match) setInstalled(true);
      })
      .catch(() => {
        /* feature unsupported or blocked — fall back to standalone detection */
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Only use the captured prompt when it matches the app this button installs.
  // (If we don't know which app it was for, allow it.)
  const modeMatches = !mode || !promptMode || promptMode === mode;
  const usablePrompt = promptEvent && modeMatches ? promptEvent : null;

  let state: PwaInstallState;
  if (installed) state = "installed";
  else if (usablePrompt) state = "can-prompt";
  else if (isIosDevice()) state = "ios-safari";
  else if (isAndroidDevice()) state = "android-no-prompt";
  else state = "desktop-no-prompt";

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    const evt = usablePrompt ?? (modeMatches ? getStoredPrompt() : null);
    if (!evt) return "unavailable";
    evt.prompt();
    const choice = await evt.userChoice;
    // The deferred prompt is single-use — drop it regardless of the outcome so
    // the UI falls back to manual instructions instead of a dead button.
    clearStoredPrompt();
    setPromptEvent(null);
    setPromptMode(null);
    if (choice.outcome === "accepted") setInstalled(true);
    return choice.outcome;
  }, [usablePrompt, modeMatches]);

  return {
    state,
    installed,
    canPrompt: Boolean(usablePrompt),
    promptInstall,
  };
}
