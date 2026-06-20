import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Headphones } from "lucide-react";
import { InstallButton } from "@/components/install-button";
import { AppRefreshHelp } from "@/components/app-refresh-help";

export default function CollectorInstall() {
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
            <InstallButton mode="collector" label="Install Collector App" />
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
        <AppRefreshHelp />
      </div>
    </div>
  );
}
