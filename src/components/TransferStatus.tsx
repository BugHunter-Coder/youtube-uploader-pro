import { CheckCircle2, XCircle, Loader2, Download, Upload, Video } from "lucide-react";

type StatusStep = "idle" | "fetching" | "downloading" | "uploading" | "complete" | "error";

interface TransferStatusProps {
  status: StatusStep;
  error?: string;
  progress?: number;
  mode?: "youtube" | "direct" | "file";
}

export function TransferStatus({ status, error, progress, mode = "direct" }: TransferStatusProps) {
  if (status === "idle") return null;

  const steps =
    mode === "file"
      ? [
          { id: "fetching", label: "Preparing file", icon: Video },
          { id: "downloading", label: "Uploading file", icon: Download },
          { id: "uploading", label: "Uploading to your channel", icon: Upload },
          { id: "complete", label: "Upload complete", icon: CheckCircle2 },
        ]
      : mode === "youtube"
      ? [
          { id: "fetching", label: "Fetching video info", icon: Video },
          { id: "downloading", label: "Downloading from YouTube (Python yt-dlp)", icon: Download },
          { id: "uploading", label: "Uploading to your channel", icon: Upload },
          { id: "complete", label: "Transfer complete", icon: CheckCircle2 },
        ]
      : [
          { id: "fetching", label: "Preparing URL", icon: Video },
          { id: "downloading", label: "Downloading file", icon: Download },
          { id: "uploading", label: "Uploading to your channel", icon: Upload },
          { id: "complete", label: "Transfer complete", icon: CheckCircle2 },
        ];

  const currentStepIndex = steps.findIndex((s) => s.id === status);

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === status;
          const isComplete = currentStepIndex > index || status === "complete";
          const isPending = currentStepIndex < index && status !== "error";

          return (
            <div
              key={step.id}
              className={`flex items-center gap-4 transition-opacity duration-300 ${
                isPending ? "opacity-40" : "opacity-100"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-300 ${
                  isComplete
                    ? "bg-success text-success-foreground"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                
                {isActive && progress !== undefined && (
                  <div className="mt-2 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status === "error" && error && (
        <div className="mt-4 flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Transfer Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {status === "complete" && (
        <div className="mt-4 flex items-start gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-success">Success!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your video has been transferred to your YouTube channel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
