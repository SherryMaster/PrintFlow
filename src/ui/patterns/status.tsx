import type { StatusPresentation } from "@/ui/status";
import { Badge } from "@/ui/primitives/badge";

const toneClasses = {
  neutral: "bg-muted text-foreground",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
} as const;

export function StatusBadge({ status }: { status: StatusPresentation }) {
  const Icon = status.icon;
  return (
    <Badge className={toneClasses[status.tone]}>
      <Icon aria-hidden="true" />
      {status.label}
    </Badge>
  );
}

export function StatusDetail({ status }: { status: StatusPresentation }) {
  return (
    <div className="flex flex-col gap-2">
      <StatusBadge status={status} />
      {status.explanation && (
        <p className="text-sm text-muted-foreground">{status.explanation}</p>
      )}
      {status.nextAction && (
        <a
          className="w-fit text-sm font-medium text-foreground underline underline-offset-4"
          href={status.nextAction.href}
        >
          {status.nextAction.label}
        </a>
      )}
    </div>
  );
}
