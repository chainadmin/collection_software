import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  Download,
  CheckCircle,
  Share,
  Plus,
  MoreVertical,
  MonitorDown,
} from "lucide-react";

interface InstallButtonProps {
  mode?: "admin" | "collector";
  label?: string;
  className?: string;
}

interface Step {
  icon: React.ReactNode;
  text: React.ReactNode;
}

function InstructionCard({
  title,
  steps,
}: {
  title: string;
  steps: Step[];
}) {
  return (
    <div
      className="rounded-lg border bg-muted/50 p-4 space-y-3"
      data-testid="card-install-instructions"
    >
      <p className="text-sm font-medium">{title}</p>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background border text-foreground">
              {step.icon}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function InstallButton({
  mode = "admin",
  label,
  className,
}: InstallButtonProps) {
  const { state, promptInstall } = usePwaInstall(mode);
  const [showSteps, setShowSteps] = useState(false);

  const appName = mode === "collector" ? "Collector App" : "Desktop App";
  const buttonLabel = label ?? `Install ${appName}`;
  const openPath = mode === "collector" ? "/collector-login" : "/login";
  const openLabel = mode === "collector" ? "Open Collector Login" : "Open App";

  if (state === "installed") {
    return (
      <div className={className}>
        <div
          className="flex flex-col items-center gap-3 py-2"
          data-testid="status-app-installed"
        >
          <CheckCircle className="h-10 w-10 text-green-600" />
          <p className="text-sm text-muted-foreground text-center">
            You're all set — the app is installed. Open it from your home screen,
            desktop, or taskbar.
          </p>
          <Link href={openPath}>
            <Button variant="outline" data-testid="button-open-installed-app">
              {openLabel}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (state === "can-prompt") {
    return (
      <div className={className}>
        <Button
          className="w-full"
          onClick={() => promptInstall()}
          data-testid="button-install-app"
        >
          <Download className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </div>
    );
  }

  if (state === "ios-safari") {
    return (
      <div className={className}>
        <InstructionCard
          title="Install on iPhone or iPad"
          steps={[
            {
              icon: <Share className="h-4 w-4" />,
              text: (
                <>
                  Tap the <strong>Share</strong> button in Safari's toolbar
                </>
              ),
            },
            {
              icon: <Plus className="h-4 w-4" />,
              text: (
                <>
                  Choose <strong>Add to Home Screen</strong>
                </>
              ),
            },
            {
              icon: <CheckCircle className="h-4 w-4" />,
              text: (
                <>
                  Tap <strong>Add</strong> — the app appears on your home screen
                </>
              ),
            },
          ]}
        />
      </div>
    );
  }

  // android-no-prompt or desktop-no-prompt: show a button that reveals steps.
  const steps: Step[] =
    state === "android-no-prompt"
      ? [
          {
            icon: <MoreVertical className="h-4 w-4" />,
            text: (
              <>
                Tap the browser <strong>menu</strong> (three dots)
              </>
            ),
          },
          {
            icon: <Download className="h-4 w-4" />,
            text: (
              <>
                Choose <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong>
              </>
            ),
          },
        ]
      : [
          {
            icon: <MonitorDown className="h-4 w-4" />,
            text: (
              <>
                Click the <strong>install icon</strong> on the right of the
                address bar
              </>
            ),
          },
          {
            icon: <MoreVertical className="h-4 w-4" />,
            text: (
              <>
                Or open the browser menu and choose <strong>Install app</strong>
              </>
            ),
          },
        ];

  return (
    <div className={className}>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowSteps((s) => !s)}
        data-testid="button-install-app"
      >
        <Download className="h-4 w-4 mr-2" />
        {buttonLabel}
      </Button>
      {showSteps && (
        <div className="mt-3">
          <InstructionCard
            title={
              state === "android-no-prompt"
                ? "Install on Android"
                : "Install on your computer"
            }
            steps={steps}
          />
        </div>
      )}
    </div>
  );
}
