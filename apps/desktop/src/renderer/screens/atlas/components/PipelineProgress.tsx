import { cn } from "@superset/ui/utils";
import { Button } from "@superset/ui/button";
import { LuCheck, LuLoader, LuX, LuCircle } from "react-icons/lu";

export type PipelineStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

interface PipelineStep {
  label: string;
  status: PipelineStepStatus;
  message?: string;
}

interface PipelineProgressProps {
  steps: PipelineStep[];
  onRetry?: (stepIndex: number) => void;
  onSkip?: (stepIndex: number) => void;
}

const STATUS_ICON: Record<PipelineStepStatus, React.ReactNode> = {
  pending: <div className="size-2 rounded-full bg-muted-foreground" />,
  running: <LuLoader className="size-4 animate-spin text-primary" />,
  done: <LuCheck className="size-4 text-green-500" />,
  failed: <LuX className="size-4 text-destructive" />,
  skipped: <LuCircle className="size-4 text-muted-foreground" />,
};

export function PipelineProgress({ steps, onRetry, onSkip }: PipelineProgressProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            step.status === "running" && "border-primary bg-primary/5",
            step.status === "failed" && "border-destructive bg-destructive/5",
            step.status === "done" && "border-green-500/30",
            step.status === "pending" && "border-border",
            step.status === "skipped" && "border-border opacity-50",
          )}
        >
          <div className="flex items-center justify-center size-6">
            {STATUS_ICON[step.status]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{step.label}</p>
            {step.message ? (
              <p className="text-xs text-muted-foreground mt-0.5">{step.message}</p>
            ) : null}
          </div>
          {step.status === "failed" ? (
            <div className="flex gap-1">
              {onSkip ? (
                <Button variant="ghost" size="sm" onClick={() => onSkip(i)}>
                  건너뛰기
                </Button>
              ) : null}
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={() => onRetry(i)}>
                  재시도
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
