import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Headphones, Download, CheckCircle } from "lucide-react";

export default function CollectorInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (existingManifest) {
      existingManifest.setAttribute("href", "/manifest-collector.json");
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (existingManifest) {
        existingManifest.setAttribute("href", "/manifest.json");
      }
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        // Note: do NOT set appMode here. Installing the PWA shouldn't lock
        // this browser into collector mode — that would break the admin app
        // for the same computer/browser. appMode is set when the user
        // actually logs into the collector workstation.
      }
    } else {
      alert('To install: Click the install icon in your browser address bar, or use your browser menu to "Install App".');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/logo.png" alt="Debt Manager Pro" className="h-12 w-auto mx-auto mb-4" />
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Headphones className="h-6 w-6 text-primary" />
              <CardTitle>DMP Collector App</CardTitle>
            </div>
            <CardDescription>
              Install the Collector Workstation app for quick access to your work queue, whiteboard, and collection tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
                <p className="text-sm text-muted-foreground text-center">
                  The Collector App is installed. You can open it from your desktop or taskbar.
                </p>
                <Link href="/collector-login">
                  <Button variant="outline" data-testid="button-open-collector">
                    Open Collector Login
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Button className="w-full" onClick={handleInstall} data-testid="button-install-collector">
                  <Download className="h-4 w-4 mr-2" />
                  Install Collector App
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Works on Chrome, Edge, and other Chromium-based browsers. On iOS, use Safari's "Add to Home Screen".
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/collector-login" className="hover:underline">
            Collector Login
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
