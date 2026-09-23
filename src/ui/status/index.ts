import type { LucideIcon } from "lucide-react";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  LoaderCircle,
} from "lucide-react";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";
export type StatusPresentation = {
  label: string;
  tone: StatusTone;
  explanation?: string;
  nextAction?: { label: string; href: string };
  icon: LucideIcon;
};

const icons: Record<StatusTone, LucideIcon> = {
  neutral: CircleHelp,
  info: Clock3,
  warning: CircleAlert,
  success: CircleCheck,
  danger: CircleAlert,
};

export function presentStatus(
  input: Omit<StatusPresentation, "icon">,
): StatusPresentation {
  return { ...input, icon: icons[input.tone] };
}

export const loadingStatus: StatusPresentation = {
  label: "In progress",
  tone: "info",
  icon: LoaderCircle,
};
