import {
  Ban,
  CalendarDays,
  CircleCheck,
  Clock,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import type {
  DisplayStatus,
  DisplayTone,
} from "@/lib/expirations/display-status";
import { cn } from "@/lib/utils";

const ICONS = {
  alert: TriangleAlert,
  clock: Clock,
  calendar: CalendarDays,
  refresh: RefreshCw,
  check: CircleCheck,
  ban: Ban,
} as const;

/** Fundo claro + texto escuro da mesma cor (docs/UI-MOCKUPS.md §4). */
const TONES: Record<DisplayTone, string> = {
  danger: "bg-danger/10 text-danger",
  orange: "bg-orange/10 text-orange",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
};

/** Badge de situação: ícone, texto e cor juntos (SRS RF-07). */
export function ExpirationStatusBadge({ status }: { status: DisplayStatus }) {
  const Icon = ICONS[status.icon];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONES[status.tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {status.label}
    </span>
  );
}
