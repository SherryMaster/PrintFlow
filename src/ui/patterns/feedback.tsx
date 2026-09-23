import { AlertCircle, CheckCircle2, CloudUpload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/ui/primitives/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/ui/primitives/empty";
import { Progress } from "@/ui/primitives/progress";
import { Skeleton } from "@/ui/primitives/skeleton";

export function InlineOutcome({
  kind,
  title,
  children,
}: {
  kind: "error" | "success" | "blocked";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <Alert
      role={kind === "success" ? "status" : "alert"}
      variant={kind === "error" ? "destructive" : "default"}
    >
      <Icon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading content"
      className="flex flex-col gap-3"
    >
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function UploadProgress({
  filename,
  percent,
  interrupted = false,
}: {
  filename: string;
  percent: number;
  interrupted?: boolean;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <section
      aria-label={`Upload: ${filename}`}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="mb-2 flex items-start gap-3">
        <CloudUpload
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{filename}</p>
          <p className="text-sm text-muted-foreground" role="status">
            {interrupted
              ? "Upload interrupted. Try again."
              : `${value}% uploaded`}
          </p>
        </div>
      </div>
      <Progress value={value} aria-label="File upload progress" />
    </section>
  );
}
